import { db, type SegmentCacheEntity } from './Database';
import { hashText } from '../lib/hash';
import type { ReaderChunk } from '../lib/readerModel';

const buildCacheId = (docId: string, paraId: number) => `${docId}:${paraId}`;

export class SegmentCacheStore {
    async getChunks(docId: string, paraId: number, paragraphText: string, language: string = 'en'): Promise<ReaderChunk[] | null> {
        const id = buildCacheId(docId, paraId);
        const cached = await db.segmentCache.get(id);
        if (!cached) return null;

        const hash = hashText(`${language}|${paragraphText}`);
        if (cached.paragraphHash !== hash) return null;

        return cached.chunks.map(chunk => ({
            id: `${docId}:${paraId}:${chunk.startOffset}`,
            text: chunk.text,
            startOffset: chunk.startOffset,
            endOffset: chunk.endOffset,
            sentenceId: chunk.sentenceId,
            paraId: chunk.paraId
        }));
    }

    async setChunks(docId: string, paraId: number, paragraphText: string, chunks: ReaderChunk[], language: string = 'en') {
        const now = Date.now();
        const entity: SegmentCacheEntity = {
            id: buildCacheId(docId, paraId),
            docId,
            paraId,
            paragraphHash: hashText(`${language}|${paragraphText}`),
            chunks: chunks.map(chunk => ({
                text: chunk.text,
                startOffset: chunk.startOffset,
                endOffset: chunk.endOffset,
                sentenceId: chunk.sentenceId,
                paraId: chunk.paraId
            })),
            createdAt: now,
            lastUpdated: now
        };

        await db.segmentCache.put(entity);
    }

    async clearForDoc(docId: string) {
        await db.segmentCache.where('docId').equals(docId).delete();
    }
}

export const segmentCacheStore = new SegmentCacheStore();
