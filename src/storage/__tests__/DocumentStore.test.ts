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
        await store.updateProgress(doc.id, 50, 400);

        const retrieved = await store.getDocument(doc.id);
        expect(retrieved?.progressTokenIndex).toBe(50);
        expect(retrieved?.speedWpm).toBe(400);
    });

    it('should delete document via bulkDelete', async () => {
        const doc = await store.createDocument('Test', 'Content');
        await store.bulkDeleteDocuments([doc.id]);

        const retrieved = await store.getDocument(doc.id);
        expect(retrieved).toBeUndefined();
    });
});
