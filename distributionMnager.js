/*
 * 3CONSOLE DISTRIBUTION MANAGER
 * -----------------------------
 * Builds the downloadable 3Console ZIP package.
 *
 * This is a distribution-layer system.
 * It does not initialize, modify, or replace the 3Console runtime.
 */

import {
    getDistributionFiles
} from "./distributionManifest.js";

const ZIP_FILE_NAME = "3Console.zip";

function createCRC32Table() {
    const table = new Uint32Array(256);

    for (let i = 0; i < 256; i++) {
        let value = i;

        for (let bit = 0; bit < 8; bit++) {
            if (value & 1) {
                value = 0xEDB88320 ^ (value >>> 1);
            } else {
                value >>>= 1;
            }
        }

        table[i] = value >>> 0;
    }

    return table;
}

const CRC32_TABLE = createCRC32Table();

function crc32(data) {
    let crc = 0xFFFFFFFF;

    for (let i = 0; i < data.length; i++) {
        crc =
            CRC32_TABLE[(crc ^ data[i]) & 0xFF] ^
            (crc >>> 8);
    }

    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function writeUInt16(value) {
    const buffer = new Uint8Array(2);
    const view = new DataView(buffer.buffer);

    view.setUint16(0, value, true);

    return buffer;
}

function writeUInt32(value) {
    const buffer = new Uint8Array(4);
    const view = new DataView(buffer.buffer);

    view.setUint32(0, value >>> 0, true);

    return buffer;
}

function concatArrays(arrays) {
    let totalLength = 0;

    for (const array of arrays) {
        totalLength += array.length;
    }

    const result = new Uint8Array(totalLength);

    let offset = 0;

    for (const array of arrays) {
        result.set(array, offset);
        offset += array.length;
    }

    return result;
}

function createLocalHeader(fileNameBytes, data) {
    const header = concatArrays([
        writeUInt32(0x04034B50),
        writeUInt16(20),
        writeUInt16(0),
        writeUInt16(0),
        writeUInt16(0),
        writeUInt16(0),
        writeUInt32(crc32(data)),
        writeUInt32(data.length),
        writeUInt32(data.length),
        writeUInt16(fileNameBytes.length),
        writeUInt16(0),
        fileNameBytes
    ]);

    return header;
}

function createCentralHeader(
    fileNameBytes,
    data,
    localHeaderOffset
) {
    const header = concatArrays([
        writeUInt32(0x02014B50),
        writeUInt16(20),
        writeUInt16(20),
        writeUInt16(0),
        writeUInt16(0),
        writeUInt16(0),
        writeUInt16(0),
        writeUInt32(crc32(data)),
        writeUInt32(data.length),
        writeUInt32(data.length),
        writeUInt16(fileNameBytes.length),
        writeUInt16(0),
        writeUInt16(0),
        writeUInt16(0),
        writeUInt16(0),
        writeUInt32(0),
        writeUInt32(localHeaderOffset),
        fileNameBytes
    ]);

    return header;
}

function createEndRecord(
    fileCount,
    centralDirectorySize,
    centralDirectoryOffset
) {
    return concatArrays([
        writeUInt32(0x06054B50),
        writeUInt16(0),
        writeUInt16(0),
        writeUInt16(fileCount),
        writeUInt16(fileCount),
        writeUInt32(centralDirectorySize),
        writeUInt32(centralDirectoryOffset),
        writeUInt16(0)
    ]);
}

async function fetchFile(path) {
    const response = await fetch(`./${path}`, {
        cache: "no-store"
    });

    if (!response.ok) {
        throw new Error(
            `Unable to load distribution file: ${path} (${response.status})`
        );
    }

    return new Uint8Array(
        await response.arrayBuffer()
    );
}

function buildZip(files) {
    const localRecords = [];
    const centralRecords = [];

    let offset = 0;

    for (const file of files) {
        const nameBytes = new TextEncoder().encode(file.path);

        const localHeader = createLocalHeader(
            nameBytes,
            file.data
        );

        localRecords.push(localHeader);
        localRecords.push(file.data);

        const centralHeader = createCentralHeader(
            nameBytes,
            file.data,
            offset
        );

        centralRecords.push(centralHeader);

        offset += localHeader.length + file.data.length;
    }

    const centralDirectoryOffset = offset;

    let centralDirectorySize = 0;

    for (const record of centralRecords) {
        centralDirectorySize += record.length;
    }

    const endRecord = createEndRecord(
        files.length,
        centralDirectorySize,
        centralDirectoryOffset
    );

    return concatArrays([
        ...localRecords,
        ...centralRecords,
        endRecord
    ]);
}

function downloadBlob(data) {
    const blob = new Blob(
        [data],
        {
            type: "application/zip"
        }
    );

    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = ZIP_FILE_NAME;
    anchor.style.display = "none";

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);
}

export async function download3Console() {
    const paths = getDistributionFiles();

    if (!Array.isArray(paths) || paths.length === 0) {
        throw new Error(
            "3Console distribution manifest contains no files."
        );
    }

    const files = [];

    for (const path of paths) {
        const data = await fetchFile(path);

        files.push({
            path,
            data
        });
    }

    const zipData = buildZip(files);

    downloadBlob(zipData);

    return {
        fileName: ZIP_FILE_NAME,
        fileCount: files.length,
        size: zipData.length
    };
}

export default {
    download3Console
};