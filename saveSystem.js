class SaveSystem {
    constructor(storageManager) {
        if (!storageManager) {
            throw new Error(
                "SaveSystem requires a StorageManager."
            );
        }
        
        this.storage = storageManager;
    }
    
    createKey(gameId, slot = "default") {
        if (
            gameId === null ||
            gameId === undefined ||
            String(gameId).trim() === ""
        ) {
            throw new Error(
                "SaveSystem requires a game ID."
            );
        }
        
        if (
            slot === null ||
            slot === undefined ||
            String(slot).trim() === ""
        ) {
            slot = "default";
        }
        
        return `save:${String(gameId)}:${String(slot)}`;
    }
    
    async save(gameId, data, slot = "default") {
        const key =
            this.createKey(gameId, slot);
        
        const record = {
            gameId: String(gameId),
            slot: String(slot),
            savedAt: Date.now(),
            data
        };
        
        await this.storage.set(
            key,
            record
        );
        
        return record;
    }
    
    async load(gameId, slot = "default") {
        const key =
            this.createKey(gameId, slot);
        
        const record =
            await this.storage.get(key);
        
        if (!record) {
            return null;
        }
        
        return record;
    }
    
    async delete(gameId, slot = "default") {
        const key =
            this.createKey(gameId, slot);
        
        await this.storage.remove(key);
        
        return true;
    }
    
    async list(gameId) {
        if (
            gameId === null ||
            gameId === undefined ||
            String(gameId).trim() === ""
        ) {
            throw new Error(
                "SaveSystem requires a game ID."
            );
        }
        
        const prefix =
            `save:${String(gameId)}:`;
        
        return await this.storage.getByPrefix(
            prefix
        );
    }
    
    async has(gameId, slot = "default") {
        const key =
            this.createKey(gameId, slot);
        
        const record =
            await this.storage.get(key);
        
        return record !== null;
    }
    
    async clearGame(gameId) {
        const saves =
            await this.list(gameId);
        
        for (
            const save of saves
        ) {
            if (
                save &&
                save.gameId !== undefined &&
                save.slot !== undefined
            ) {
                await this.delete(
                    save.gameId,
                    save.slot
                );
            }
        }
        
        return true;
    }
}

export {
    SaveSystem
};

export default SaveSystem;