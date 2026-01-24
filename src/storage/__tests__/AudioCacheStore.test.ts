import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../Database';
import { AudioCacheStore } from '../AudioCacheStore';
import type { AudioAsset } from '@spec/types';

describe('AudioCacheStore', () => {
    let store: AudioCacheStore;

    beforeEach(async () => {
        store = new AudioCacheStore();
        db.close();
        await db.delete();
        await db.open();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('saves and retrieves a chunk', async () => {
        vi.spyOn(Date, 'now').mockReturnValue(1000);
        const data = new ArrayBuffer(4);
        const asset: AudioAsset = {
            chunkHash: 'chunk-1',
            sampleRate: 22050,
            durationSec: 1.2,
            encoding: 'WAV',
            data,
            lastAccessMs: 0,
            sizeBytes: 4
        };

        await store.saveChunk('chunk-1', asset);
        const retrieved = await store.getChunk('chunk-1');

        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe('chunk-1');
        const storedData = retrieved?.data as ArrayBuffer | Blob | ArrayBufferView | undefined;
        expect(storedData).toBeDefined();
        if (!storedData) {
            throw new Error('Stored data missing');
        }

        const dataAny = storedData as unknown as { byteLength?: number; size?: number };
        const size = storedData instanceof ArrayBuffer
            ? storedData.byteLength
            : ArrayBuffer.isView(storedData)
                ? storedData.byteLength
                : storedData instanceof Blob
                    ? storedData.size
                    : typeof dataAny.byteLength === 'number'
                        ? dataAny.byteLength
                        : typeof dataAny.size === 'number'
                            ? dataAny.size
                            : undefined;

        expect(size).toBe(4);
        expect(retrieved?.durationSec).toBe(1.2);
    });

    it('updates access time on get', async () => {
        const nowSpy = vi.spyOn(Date, 'now');
        const values = [1000, 2000];
        nowSpy.mockImplementation(() => values.shift() ?? 2000);

        const asset: AudioAsset = {
            chunkHash: 'chunk-2',
            sampleRate: 22050,
            durationSec: 2,
            encoding: 'WAV',
            data: new ArrayBuffer(2),
            lastAccessMs: 0,
            sizeBytes: 2
        };

        await store.saveChunk('chunk-2', asset);
        await store.getChunk('chunk-2');
        await new Promise(resolve => setTimeout(resolve, 0));

        const updated = await db.audioCache.get('chunk-2');
        expect(updated?.lastAccessMs).toBe(2000);
    });

    it('computes total usage', async () => {
        const assetA: AudioAsset = {
            chunkHash: 'chunk-a',
            sampleRate: 22050,
            durationSec: 1,
            encoding: 'WAV',
            data: new ArrayBuffer(5),
            lastAccessMs: 0,
            sizeBytes: 5
        };
        const assetB: AudioAsset = {
            chunkHash: 'chunk-b',
            sampleRate: 22050,
            durationSec: 1,
            encoding: 'WAV',
            data: new ArrayBuffer(7),
            lastAccessMs: 0,
            sizeBytes: 7
        };

        await store.saveChunk('chunk-a', assetA);
        await store.saveChunk('chunk-b', assetB);

        const usage = await store.getUsage();
        expect(usage).toBe(12);
    });

    it('evicts least recently used entries', async () => {
        const nowSpy = vi.spyOn(Date, 'now');
        nowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(2000).mockReturnValueOnce(3000);

        const assetA: AudioAsset = {
            chunkHash: 'chunk-old',
            sampleRate: 22050,
            durationSec: 1,
            encoding: 'WAV',
            data: new ArrayBuffer(5),
            lastAccessMs: 0,
            sizeBytes: 5
        };
        const assetB: AudioAsset = {
            chunkHash: 'chunk-mid',
            sampleRate: 22050,
            durationSec: 1,
            encoding: 'WAV',
            data: new ArrayBuffer(7),
            lastAccessMs: 0,
            sizeBytes: 7
        };
        const assetC: AudioAsset = {
            chunkHash: 'chunk-new',
            sampleRate: 22050,
            durationSec: 1,
            encoding: 'WAV',
            data: new ArrayBuffer(9),
            lastAccessMs: 0,
            sizeBytes: 9
        };

        await store.saveChunk('chunk-old', assetA);
        await store.saveChunk('chunk-mid', assetB);
        await store.saveChunk('chunk-new', assetC);

        const freed = await store.evictLRU(10);
        expect(freed).toBe(12);

        const remainingOld = await db.audioCache.get('chunk-old');
        const remainingMid = await db.audioCache.get('chunk-mid');
        const remainingNew = await db.audioCache.get('chunk-new');

        expect(remainingOld).toBeUndefined();
        expect(remainingMid).toBeUndefined();
        expect(remainingNew).toBeDefined();
    });
});
