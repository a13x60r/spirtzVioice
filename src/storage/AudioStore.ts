import { db, type AudioChunkEntity } from './Database';

export class AudioStore {

    /**
     * Save a synthesized audio chunk to IndexedDB
     */
    async saveChunk(hash: string, data: Blob, duration: number): Promise<void> {
        await db.audioChunks.put({
            id: hash,
            data,
            duration
        });
    }

    /**
     * Retrieve a chunk from DB
     */
    async getChunk(hash: string): Promise<AudioChunkEntity | undefined> {
        return await db.audioChunks.get(hash);
    }

    /**
     * Check if a chunk exists
     */
    async hasChunk(hash: string): Promise<boolean> {
        const count = await db.audioChunks.where('id').equals(hash).count();
        return count > 0;
    }

    /**
     * Delete a chunk from DB
     */
    async deleteChunk(hash: string): Promise<void> {
        await db.audioChunks.delete(hash);
    }

    /**
     * Delete multiple chunks from DB
     */
    async deleteChunks(hashes: string[]): Promise<void> {
        if (hashes.length === 0) return;
        await db.audioChunks.bulkDelete(hashes);
    }

    /**
     * Get just the duration of a chunk (faster than fetching blob)
     */
    async getDuration(hash: string): Promise<number | undefined> {
        const chunk = await db.audioChunks.get(hash);
        return chunk?.duration;
    }
}

export const audioStore = new AudioStore();
