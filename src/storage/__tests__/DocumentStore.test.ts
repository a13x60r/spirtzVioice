import 'fake-indexeddb/auto'; // Mock IndexedDB - MUST BE FIRST
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../Database';
import { DocumentStore } from '../DocumentStore';

describe('DocumentStore', () => {
    let store: DocumentStore;

    beforeEach(async () => {
        try {
            store = new DocumentStore();
            db.close();
            await db.delete();
            await db.open();
        } catch (e) {
            console.error('Database setup failed:', e);
            throw e;
        }
    });

    it('should create and retrieve a document', async () => {
        const doc = await store.createDocument('Test Doc', 'Hello world');
        const retrieved = await store.getDocument(doc.id);

        expect(retrieved).toBeDefined();
        expect(retrieved?.title).toBe('Test Doc');
        expect(retrieved?.id).toBe(doc.id);
    });

    it('should update progress and wpm', async () => {
        const doc = await store.createDocument('Test', 'Content');
        await store.updateReadingState(doc.id, {
            progressTokenIndex: 50,
            progressOffset: 120,
            progressChunkIndex: 3,
            progressParaId: 1,
            progressScrollTop: 240,
            speedWpm: 400,
            mode: 'FOCUS'
        });

        const retrieved = await store.getDocument(doc.id);
        expect(retrieved?.progressTokenIndex).toBe(50);
        expect(retrieved?.speedWpm).toBe(400);
        expect(retrieved?.progressOffset).toBe(120);
        expect(retrieved?.progressChunkIndex).toBe(3);
        expect(retrieved?.progressParaId).toBe(1);
        expect(retrieved?.progressScrollTop).toBe(240);
        expect(retrieved?.mode).toBe('FOCUS');
    });

    it('should delete document via bulkDelete', async () => {
        const doc = await store.createDocument('Test', 'Content');
        await store.bulkDeleteDocuments([doc.id]);

        const retrieved = await store.getDocument(doc.id);
        expect(retrieved).toBeUndefined();
    });
});
