// packageManager.js

import ZipReader from "./zipReader.js";

export class PackageManager {
    constructor(storageManager) {
        this.storage = storageManager;
        this.zipReader = new ZipReader();

        this.games = [];
        this.storageKey = "installedGames";
    }

    async init() {
        const stored = await this.storage.get(this.storageKey);

        this.games = this.normalizeStoredGames(stored);

        /*
         * Always keep the persistent value in the exact format
         * expected by the rest of 3Console.
         */
        if (!Array.isArray(stored)) {
            await this.storage.set(
                this.storageKey,
                this.games
            );
        }

        return this.games;
    }

    normalizeStoredGames(value) {
        if (Array.isArray(value)) {
            return value.filter(
                game =>
                    game &&
                    typeof game === "object" &&
                    typeof game.id === "string"
            );
        }

        /*
         * Recover from older storage formats if one exists.
         */
        if (
            value &&
            typeof value === "object"
        ) {
            if (Array.isArray(value.games)) {
                return value.games.filter(
                    game =>
                        game &&
                        typeof game === "object" &&
                        typeof game.id === "string"
                );
            }

            if (Array.isArray(value.value)) {
                return value.value.filter(
                    game =>
                        game &&
                        typeof game === "object" &&
                        typeof game.id === "string"
                );
            }
        }

        return [];
    }

    async installPackage(file) {
        if (!(file instanceof Blob)) {
            throw new TypeError(
                "PackageManager.installPackage() requires a ZIP File."
            );
        }

        const fileName =
            file.name || "game.zip";

        if (!fileName.toLowerCase().endsWith(".zip")) {
            throw new Error(
                "3Console only accepts ZIP game packages."
            );
        }

        const files =
            await this.zipReader.read(file);

        if (
            !Array.isArray(files) ||
            files.length === 0
        ) {
            throw new Error(
                "Game package contains no files."
            );
        }

        let manifest = null;

        try {
            manifest =
                this.zipReader.findManifest(files);
        } catch (error) {
            throw error;
        }

        let manifestData = null;

        if (manifest) {
            manifestData =
                await this.readManifest(manifest);
        }

        const entry =
            this.resolveEntry(
                files,
                manifest,
                manifestData
            );

        const name =
            this.resolveGameName(
                fileName,
                manifestData,
                entry
            );

        const version =
            manifestData &&
            typeof manifestData.version === "string" &&
            manifestData.version.trim()
                ? manifestData.version.trim()
                : "1.0.0";

        const game = {
            id: this.createGameId(
                name,
                fileName
            ),

            name,

            version,

            entry,

            installedAt: Date.now(),

            packageName: fileName,

            files: files.map(fileEntry => ({
                path:
                    this.zipReader.normalizePath(
                        fileEntry.path
                    ),
                data: fileEntry.data
            }))
        };

        this.validateGame(game);

        /*
         * Make absolutely sure games is an array before
         * performing any array operation.
         */
        if (!Array.isArray(this.games)) {
            this.games = [];
        }

        const existingIndex =
            this.games.findIndex(
                installedGame =>
                    installedGame.id === game.id
            );

        if (existingIndex >= 0) {
            this.games[existingIndex] = game;
        } else {
            this.games.push(game);
        }

        await this.storage.set(
            this.storageKey,
            this.games
        );

        return game;
    }

    async readManifest(manifestFile) {
        if (
            !manifestFile ||
            !manifestFile.data
        ) {
            return null;
        }

        try {
            const text =
                new TextDecoder().decode(
                    manifestFile.data
                );

            const data =
                JSON.parse(text);

            if (
                !data ||
                typeof data !== "object" ||
                Array.isArray(data)
            ) {
                throw new Error(
                    "manifest.json must contain a JSON object."
                );
            }

            return data;
        } catch (error) {
            throw new Error(
                `Invalid manifest.json: ${error.message}`
            );
        }
    }

    resolveEntry(
        files,
        manifest,
        manifestData
    ) {
        if (
            manifestData &&
            typeof manifestData.entry === "string" &&
            manifestData.entry.trim()
        ) {
            let entry =
                this.zipReader.normalizePath(
                    manifestData.entry
                );

            /*
             * If the manifest is inside a folder,
             * resolve its entry relative to that folder.
             */
            if (
                manifest &&
                !this.isRootPath(manifest.path)
            ) {
                const directory =
                    this.getDirectory(
                        manifest.path
                    );

                if (
                    directory &&
                    !entry.startsWith(
                        directory + "/"
                    )
                ) {
                    entry =
                        this.zipReader.normalizePath(
                            directory +
                            "/" +
                            entry
                        );
                }
            }

            const entryFile =
                this.zipReader.findFile(
                    files,
                    entry
                );

            if (!entryFile) {
                throw new Error(
                    `Game entry file was not found: ${entry}`
                );
            }

            return entry;
        }

        const entryFile =
            this.zipReader.findEntryHtml(
                files
            );

        if (!entryFile) {
            throw new Error(
                "Could not determine the game's HTML entry file."
            );
        }

        return this.zipReader.normalizePath(
            entryFile.path
        );
    }

    resolveGameName(
        packageFileName,
        manifestData,
        entry
    ) {
        if (
            manifestData &&
            typeof manifestData.name === "string" &&
            manifestData.name.trim()
        ) {
            return manifestData.name.trim();
        }

        const entryParts =
            this.zipReader
                .normalizePath(entry)
                .split("/")
                .filter(Boolean);

        /*
         * If the game is inside one folder,
         * use that folder as the display name.
         */
        if (entryParts.length > 1) {
            const folderName =
                entryParts[0];

            if (
                folderName &&
                folderName.toLowerCase() !== "game"
            ) {
                return this.cleanGameName(
                    folderName
                );
            }
        }

        /*
         * Otherwise use the ZIP filename.
         */
        const baseName =
            packageFileName
                .replace(/\.zip$/i, "")
                .trim();

        if (baseName) {
            return this.cleanGameName(
                baseName
            );
        }

        return "Untitled Game";
    }

    cleanGameName(name) {
        return String(name)
            .replace(/[_-]+/g, " ")
            .replace(/\s+/g, " ")
            .trim() || "Untitled Game";
    }

    isRootPath(path) {
        return (
            this.zipReader
                .normalizePath(path)
                .indexOf("/") === -1
        );
    }

    getDirectory(path) {
        const normalized =
            this.zipReader.normalizePath(
                path
            );

        const lastSlash =
            normalized.lastIndexOf("/");

        if (lastSlash === -1) {
            return "";
        }

        return normalized.slice(
            0,
            lastSlash
        );
    }

    validateGame(game) {
        if (
            !game ||
            typeof game !== "object"
        ) {
            throw new Error(
                "Invalid installed game."
            );
        }

        if (!game.id) {
            throw new Error(
                "Invalid game package: game ID is missing."
            );
        }

        if (!game.name) {
            throw new Error(
                "Invalid game package: game name is missing."
            );
        }

        if (!game.entry) {
            throw new Error(
                "Invalid game package: game entry is missing."
            );
        }

        if (!Array.isArray(game.files)) {
            throw new Error(
                "Invalid game package: game files are missing."
            );
        }

        return true;
    }

    async getInstalledGames() {
        /*
         * Final safety barrier: this method can ONLY return
         * an array.
         */
        if (!Array.isArray(this.games)) {
            this.games =
                this.normalizeStoredGames(
                    this.games
                );
        }

        return this.games;
    }

    async getGame(gameId) {
        if (!Array.isArray(this.games)) {
            this.games = [];
        }

        return (
            this.games.find(
                game =>
                    game.id === gameId
            ) || null
        );
    }

    async removeGame(gameId) {
        if (!Array.isArray(this.games)) {
            this.games = [];
        }

        const index =
            this.games.findIndex(
                game =>
                    game.id === gameId
            );

        if (index === -1) {
            return false;
        }

        this.games.splice(index, 1);

        await this.storage.set(
            this.storageKey,
            this.games
        );

        return true;
    }

    createGameId(
        name,
        fileName
    ) {
        const source =
            `${name}-${fileName}-${Date.now()}`;

        let hash = 0;

        for (
            let i = 0;
            i < source.length;
            i++
        ) {
            hash =
                (hash << 5) -
                hash +
                source.charCodeAt(i);

            hash |= 0;
        }

        return (
            "game-" +
            Math.abs(hash).toString(36) +
            "-" +
            Date.now().toString(36)
        );
    }
}

export default PackageManager;