import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../Database';
import { segmentCacheStore } from '../SegmentCacheStore';

describe('SegmentCacheStore', () => {
    beforeEach(async () => {
        db.close();
        await db.delete();
        await db.open();
    });

    it('stores and retrieves cached chunks when hash matches', async () => {
        const docId = 'doc-1';
        const paraId = 0;
        const text = 'Hello world.';
        const chunks = [{
            id: 'c1',
            text: 'Hello world.',
            startOffset: 0,
            endOffset: 12,
            sentenceId: 0,
            paraId: 0
        }];

        await segmentCacheStore.setChunks(docId, paraId, text, chunks as any);
        const cached = await segmentCacheStore.getChunks(docId, paraId, text);

        expect(cached).toBeTruthy();
        expect(cached?.length).toBe(1);
        expect(cached?.[0].text).toBe('Hello world.');
    });

    it('returns null when hash mismatches', async () => {
        const docId = 'doc-2';
        const paraId = 1;
        const chunks = [{
            id: 'c1',
            text: 'Original',
            startOffset: 0,
            endOffset: 8,
            sentenceId: 0,
            paraId: 1
        }];

        await segmentCacheStore.setChunks(docId, paraId, 'Original', chunks as any);
        const cached = await segmentCacheStore.getChunks(docId, paraId, 'Changed');
        expect(cached).toBeNull();
    });
});
