import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../Database';
import { annotationStore } from '../AnnotationStore';

describe('AnnotationStore', () => {
    beforeEach(async () => {
        db.close();
        await db.delete();
        await db.open();
    });

    it('stores and retrieves highlights and notes', async () => {
        await annotationStore.addHighlight('doc-1', 10, 20, 1);
        await annotationStore.addNote('doc-1', 30, 40, 'Test note', 2);

        const annotations = await annotationStore.getAnnotations('doc-1');
        expect(annotations.length).toBe(2);
        expect(annotations[0].type).toBe('highlight');
        expect(annotations[1].type).toBe('note');
        expect(annotations[1].text).toBe('Test note');
        expect(annotations[0].paraId).toBe(1);
    });
});
