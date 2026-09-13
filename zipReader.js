// zipReader.js

export class ZipReader {
    constructor() {
        this.localHeaderSignature = 0x04034b50;
        this.centralHeaderSignature = 0x02014b50;
        this.endOfCentralDirectorySignature = 0x06054b50;
    }

    async read(file) {
        if (!(file instanceof Blob)) {
            throw new TypeError("ZipReader.read() requires a File or Blob.");
        }

        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);

        const eocdOffset = this.findEndOfCentralDirectory(bytes);

        if (eocdOffset < 0) {
            throw new Error("Invalid ZIP: end of central directory was not found.");
        }

        const view = new DataView(buffer);

        const entryCount = view.getUint16(eocdOffset + 10, true);
        const centralDirectorySize = view.getUint32(
            eocdOffset + 12,
            true
        );
        const centralDirectoryOffset = view.getUint32(
            eocdOffset + 16,
            true
        );

        if (
            entryCount === 0xffff ||
            centralDirectorySize === 0xffffffff ||
            centralDirectoryOffset === 0xffffffff
        ) {
            throw new Error("ZIP64 packages are not supported.");
        }

        const files = [];

        let offset = centralDirectoryOffset;

        for (let i = 0; i < entryCount; i++) {
            if (
                offset + 46 > bytes.length ||
                view.getUint32(offset, true) !== this.centralHeaderSignature
            ) {
                throw new Error(
                    "Invalid ZIP: central directory entry is corrupted."
                );
            }

            const compressionMethod = view.getUint16(offset + 10, true);
            const compressedSize = view.getUint32(offset + 20, true);
            const uncompressedSize = view.getUint32(offset + 24, true);

            const fileNameLength = view.getUint16(offset + 28, true);
            const extraLength = view.getUint16(offset + 30, true);
            const commentLength = view.getUint16(offset + 32, true);

            const localHeaderOffset = view.getUint32(offset + 42, true);

            const nameBytes = bytes.slice(
                offset + 46,
                offset + 46 + fileNameLength
            );

            const fileName = new TextDecoder().decode(nameBytes);
            const normalizedPath = this.normalizePath(fileName);

            offset +=
                46 +
                fileNameLength +
                extraLength +
                commentLength;

            if (!normalizedPath || normalizedPath.endsWith("/")) {
                continue;
            }

            const data = await this.readLocalFile(
                bytes,
                view,
                localHeaderOffset,
                compressedSize,
                uncompressedSize,
                compressionMethod
            );

            files.push({
                path: normalizedPath,
                data
            });
        }

        if (!files.length) {
            throw new Error("ZIP package contains no usable files.");
        }

        return files;
    }

    findEndOfCentralDirectory(bytes) {
        const minimumSize = 22;
        const maximumCommentLength = 0xffff;

        const start = Math.max(
            0,
            bytes.length - minimumSize - maximumCommentLength
        );

        for (let i = bytes.length - minimumSize; i >= start; i--) {
            if (
                bytes[i] === 0x50 &&
                bytes[i + 1] === 0x4b &&
                bytes[i + 2] === 0x05 &&
                bytes[i + 3] === 0x06
            ) {
                return i;
            }
        }

        return -1;
    }

    async readLocalFile(
        bytes,
        view,
        localHeaderOffset,
        compressedSize,
        uncompressedSize,
        compressionMethod
    ) {
        if (
            localHeaderOffset + 30 > bytes.length ||
            view.getUint32(localHeaderOffset, true) !==
                this.localHeaderSignature
        ) {
            throw new Error("Invalid ZIP: local file header is corrupted.");
        }

        const fileNameLength = view.getUint16(
            localHeaderOffset + 26,
            true
        );

        const extraLength = view.getUint16(
            localHeaderOffset + 28,
            true
        );

        const dataOffset =
            localHeaderOffset +
            30 +
            fileNameLength +
            extraLength;

        const dataEnd = dataOffset + compressedSize;

        if (dataOffset < 0 || dataEnd > bytes.length) {
            throw new Error("Invalid ZIP: file data is outside the archive.");
        }

        const compressedData = bytes.slice(dataOffset, dataEnd);

        if (compressionMethod === 0) {
            return compressedData;
        }

        if (compressionMethod === 8) {
            return await this.inflateRaw(
                compressedData,
                uncompressedSize
            );
        }

        throw new Error(
            `Unsupported ZIP compression method: ${compressionMethod}`
        );
    }

    async inflateRaw(data, expectedSize = 0) {
        if (typeof DecompressionStream === "undefined") {
            throw new Error(
                "This browser does not support ZIP DEFLATE decompression."
            );
        }

        const stream = new Blob([data])
            .stream()
            .pipeThrough(new DecompressionStream("deflate-raw"));

        const response = new Response(stream);
        const buffer = await response.arrayBuffer();

        if (
            expectedSize > 0 &&
            buffer.byteLength !== expectedSize
        ) {
            throw new Error(
                "ZIP decompression failed: extracted size does not match the archive."
            );
        }

        return new Uint8Array(buffer);
    }

    normalizePath(path) {
        let normalized = String(path || "")
            .replace(/\\/g, "/")
            .replace(/^\/+/, "");

        const parts = [];

        for (const part of normalized.split("/")) {
            if (!part || part === ".") {
                continue;
            }

            if (part === "..") {
                if (parts.length) {
                    parts.pop();
                }

                continue;
            }

            parts.push(part);
        }

        return parts.join("/");
    }

    findFile(files, requestedPath) {
        if (!Array.isArray(files)) {
            return null;
        }

        const target = this.normalizePath(requestedPath);

        return (
            files.find(
                file => this.normalizePath(file.path) === target
            ) || null
        );
    }

    findManifest(files) {
        if (!Array.isArray(files)) {
            return null;
        }

        const manifests = files.filter(file => {
            const path = this.normalizePath(file.path);

            return (
                path === "manifest.json" ||
                path.toLowerCase().endsWith("/manifest.json")
            );
        });

        if (!manifests.length) {
            return null;
        }

        const rootManifest = manifests.find(
            file => this.normalizePath(file.path) === "manifest.json"
        );

        if (rootManifest) {
            return rootManifest;
        }

        if (manifests.length === 1) {
            return manifests[0];
        }

        throw new Error(
            "3Console game package contains multiple manifest.json files."
        );
    }

    findEntryHtml(files) {
        if (!Array.isArray(files)) {
            return null;
        }

        const normalizedFiles = files
            .map(file => ({
                ...file,
                path: this.normalizePath(file.path)
            }))
            .filter(file => file.path);

        const rootIndex = normalizedFiles.find(
            file => file.path.toLowerCase() === "index.html"
        );

        if (rootIndex) {
            return rootIndex;
        }

        const indexFiles = normalizedFiles.filter(file =>
            file.path.toLowerCase().endsWith("/index.html")
        );

        if (indexFiles.length === 1) {
            return indexFiles[0];
        }

        if (indexFiles.length > 1) {
            throw new Error(
                "3Console game package contains multiple index.html files and no manifest.json."
            );
        }

        const htmlFiles = normalizedFiles.filter(file =>
            /\.(html?|HTML?)$/.test(file.path)
        );

        if (htmlFiles.length === 1) {
            return htmlFiles[0];
        }

        if (htmlFiles.length === 0) {
            throw new Error(
                "3Console game package does not contain an HTML entry file."
            );
        }

        throw new Error(
            "3Console game package contains multiple HTML files and no manifest.json to identify the entry file."
        );
    }
}

export default ZipReader;