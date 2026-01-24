import { db, type AudioAssetEntity } from './Database';
import type { AudioAsset } from '@spec/types';

export class AudioCacheStore {
    /**
     * Save audio asset
     */
    async saveChunk(chunkHash: string, data: AudioAsset) {
        const entity: AudioAssetEntity = {
            id: chunkHash,
            ...data,
            lastAccessMs: Date.now()
        };
        await db.audioCache.put(entity);
    }

    /**
     * Retrieve audio asset
     */
    async getChunk(chunkHash: string): Promise<AudioAssetEntity | undefined> {
        const chunk = await db.audioCache.get(chunkHash);
        if (chunk) {
            // Update access time asynchronously
            db.audioCache.update(chunkHash, { lastAccessMs: Date.now() }).catch(console.error);
        }
        return chunk;
    }

    /**
     * Evict items to free up space
     * @param targetBytesToFree Amount of bytes we want to free
     * @returns Amount of bytes actually freed
     */
    async evictLRU(targetBytesToFree: number): Promise<number> {
        let freedBytes = 0;

        // Iterate by oldest access time
        const items = await db.audioCache.orderBy('lastAccessMs').toArray();

        for (const item of items) {
            if (freedBytes >= targetBytesToFree) break;

            freedBytes += item.sizeBytes;
            await db.audioCache.delete(item.id);
        }

        return freedBytes;
    }

    /**
     * Get total cache usage
     */
    async getUsage(): Promise<number> {
        // Dexie doesn't have a sum aggregation easily without addons or iteration
        // Iterating all keys might be slow if cache is huge.
        // For MVP, just count.
        let total = 0;
        await db.audioCache.each(item => {
            total += item.sizeBytes;
        });
        return total;
    }
}

export const audioCacheStore = new AudioCacheStore();
