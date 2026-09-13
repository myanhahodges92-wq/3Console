class StorageManager {
    constructor(options = {}) {
        this.databaseName =
            options.databaseName || "3Console";

        /*
         * Version 2 is intentional.
         *
         * Earlier development versions may have created
         * the database without the required object store.
         * Increasing the version forces IndexedDB to run
         * onupgradeneeded and create the store.
         */
        this.databaseVersion =
            Number.isInteger(
                options.databaseVersion
            )
                ? options.databaseVersion
                : 2;

        this.storeName = "data";

        this.database = null;
        this.initialized = false;
        this.initializing = null;
    }

    async init() {
        if (
            this.initialized &&
            this.database
        ) {
            return this.database;
        }

        if (this.initializing) {
            return this.initializing;
        }

        if (
            typeof globalThis.indexedDB ===
            "undefined"
        ) {
            throw new Error(
                "3Console storage is unavailable: IndexedDB is not supported by this app environment."
            );
        }

        this.initializing =
            this.openDatabase();

        try {
            this.database =
                await this.initializing;

            this.initialized = true;

            this.database.onclose = () => {
                this.database = null;
                this.initialized = false;
            };

            this.database.onversionchange = () => {
                this.database.close();
                this.database = null;
                this.initialized = false;
            };

            this.database.onerror = event => {
                console.error(
                    "3Console IndexedDB error:",
                    event.target?.error ||
                        event
                );
            };

            /*
             * Verify that the required store actually
             * exists before allowing the rest of the
             * console to use the database.
             */
            if (
                !this.database.objectStoreNames.contains(
                    this.storeName
                )
            ) {
                this.database.close();

                this.database = null;
                this.initialized = false;

                throw new Error(
                    `3Console storage initialized incorrectly: object store "${this.storeName}" does not exist.`
                );
            }

            return this.database;
        } catch (error) {
            this.database = null;
            this.initialized = false;

            throw this.createStorageError(
                "Unable to initialize 3Console storage.",
                error
            );
        } finally {
            this.initializing = null;
        }
    }

    openDatabase() {
        return new Promise(
            (resolve, reject) => {
                let request;

                try {
                    request =
                        indexedDB.open(
                            this.databaseName,
                            this.databaseVersion
                        );
                } catch (error) {
                    reject(
                        this.createStorageError(
                            "Unable to open the 3Console database.",
                            error
                        )
                    );

                    return;
                }

                request.onupgradeneeded =
                    event => {
                        try {
                            const database =
                                event.target.result;

                            if (
                                !database.objectStoreNames.contains(
                                    this.storeName
                                )
                            ) {
                                database.createObjectStore(
                                    this.storeName,
                                    {
                                        keyPath:
                                            "key"
                                    }
                                );
                            }
                        } catch (error) {
                            reject(
                                this.createStorageError(
                                    "Unable to create the 3Console storage object store.",
                                    error
                                )
                            );
                        }
                    };

                request.onsuccess = () => {
                    resolve(
                        request.result
                    );
                };

                request.onerror = () => {
                    reject(
                        this.createStorageError(
                            "Unable to open the 3Console database.",
                            request.error
                        )
                    );
                };

                request.onblocked = () => {
                    reject(
                        new Error(
                            "3Console storage is blocked because another database connection is still open. Close other 3Console tabs/windows and reload."
                        )
                    );
                };
            }
        );
    }

    async set(key, value) {
        const database =
            await this.init();

        this.validateKey(key);

        return new Promise(
            (resolve, reject) => {
                let transaction;

                try {
                    transaction =
                        database.transaction(
                            this.storeName,
                            "readwrite"
                        );
                } catch (error) {
                    reject(
                        this.createStorageError(
                            "Unable to start the storage transaction.",
                            error
                        )
                    );

                    return;
                }

                const store =
                    transaction.objectStore(
                        this.storeName
                    );

                const request =
                    store.put({
                        key: String(key),
                        value
                    });

                request.onsuccess = () => {
                    resolve(value);
                };

                request.onerror = () => {
                    reject(
                        this.createStorageError(
                            `Unable to save storage key "${key}".`,
                            request.error
                        )
                    );
                };

                transaction.onerror = () => {
                    reject(
                        this.createStorageError(
                            `Unable to save storage key "${key}".`,
                            transaction.error
                        )
                    );
                };
            }
        );
    }

    async get(key) {
        const database =
            await this.init();

        this.validateKey(key);

        return new Promise(
            (resolve, reject) => {
                let transaction;

                try {
                    transaction =
                        database.transaction(
                            this.storeName,
                            "readonly"
                        );
                } catch (error) {
                    reject(
                        this.createStorageError(
                            "Unable to start the storage transaction.",
                            error
                        )
                    );

                    return;
                }

                const store =
                    transaction.objectStore(
                        this.storeName
                    );

                const request =
                    store.get(
                        String(key)
                    );

                request.onsuccess = () => {
                    resolve(
                        request.result
                            ? request.result.value
                            : null
                    );
                };

                request.onerror = () => {
                    reject(
                        this.createStorageError(
                            `Unable to read storage key "${key}".`,
                            request.error
                        )
                    );
                };

                transaction.onerror = () => {
                    reject(
                        this.createStorageError(
                            `Unable to read storage key "${key}".`,
                            transaction.error
                        )
                    );
                };
            }
        );
    }

    async remove(key) {
        const database =
            await this.init();

        this.validateKey(key);

        return new Promise(
            (resolve, reject) => {
                let transaction;

                try {
                    transaction =
                        database.transaction(
                            this.storeName,
                            "readwrite"
                        );
                } catch (error) {
                    reject(
                        this.createStorageError(
                            "Unable to start the storage transaction.",
                            error
                        )
                    );

                    return;
                }

                const store =
                    transaction.objectStore(
                        this.storeName
                    );

                const request =
                    store.delete(
                        String(key)
                    );

                request.onsuccess = () => {
                    resolve(true);
                };

                request.onerror = () => {
                    reject(
                        this.createStorageError(
                            `Unable to remove storage key "${key}".`,
                            request.error
                        )
                    );
                };

                transaction.onerror = () => {
                    reject(
                        this.createStorageError(
                            `Unable to remove storage key "${key}".`,
                            transaction.error
                        )
                    );
                };
            }
        );
    }

    async getByPrefix(prefix) {
        const database =
            await this.init();

        if (
            typeof prefix !==
            "string"
        ) {
            throw new Error(
                "Storage prefix must be a string."
            );
        }

        return new Promise(
            (resolve, reject) => {
                let transaction;

                try {
                    transaction =
                        database.transaction(
                            this.storeName,
                            "readonly"
                        );
                } catch (error) {
                    reject(
                        this.createStorageError(
                            "Unable to start the storage transaction.",
                            error
                        )
                    );

                    return;
                }

                const store =
                    transaction.objectStore(
                        this.storeName
                    );

                const results = [];

                const request =
                    store.openCursor();

                request.onsuccess =
                    event => {
                        const cursor =
                            event.target
                                .result;

                        if (!cursor) {
                            resolve(
                                results
                            );
                            return;
                        }

                        const record =
                            cursor.value;

                        if (
                            record &&
                            typeof record.key ===
                                "string" &&
                            record.key.startsWith(
                                prefix
                            )
                        ) {
                            results.push(
                                record.value
                            );
                        }

                        cursor.continue();
                    };

                request.onerror = () => {
                    reject(
                        this.createStorageError(
                            "Unable to read stored data.",
                            request.error
                        )
                    );
                };

                transaction.onerror =
                    () => {
                        reject(
                            this.createStorageError(
                                "Unable to read stored data.",
                                transaction.error
                            )
                        );
                    };
            }
        );
    }

    async clear() {
        const database =
            await this.init();

        return new Promise(
            (resolve, reject) => {
                let transaction;

                try {
                    transaction =
                        database.transaction(
                            this.storeName,
                            "readwrite"
                        );
                } catch (error) {
                    reject(
                        this.createStorageError(
                            "Unable to start the storage transaction.",
                            error
                        )
                    );

                    return;
                }

                const store =
                    transaction.objectStore(
                        this.storeName
                    );

                const request =
                    store.clear();

                request.onsuccess = () => {
                    resolve(true);
                };

                request.onerror = () => {
                    reject(
                        this.createStorageError(
                            "Unable to clear 3Console storage.",
                            request.error
                        )
                    );
                };

                transaction.onerror = () => {
                    reject(
                        this.createStorageError(
                            "Unable to clear 3Console storage.",
                            transaction.error
                        )
                    );
                };
            }
        );
    }

    async close() {
        if (this.database) {
            this.database.close();
        }

        this.database = null;
        this.initialized = false;
        this.initializing = null;
    }

    validateKey(key) {
        if (
            key === null ||
            key === undefined ||
            String(key).trim() === ""
        ) {
            throw new Error(
                "Storage key is required."
            );
        }
    }

    createStorageError(
        message,
        error
    ) {
        if (
            error instanceof Error
        ) {
            const name =
                error.name ||
                "Error";

            const detail =
                error.message ||
                String(error);

            return new Error(
                `${message} ${name}: ${detail}`
            );
        }

        if (error) {
            return new Error(
                `${message} ${String(error)}`
            );
        }

        return new Error(message);
    }
}

export {
    StorageManager
};

export default StorageManager;