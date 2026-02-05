import { db, type AnnotationEntity } from './Database';
import { v4 as uuidv4 } from 'uuid';

export class AnnotationStore {
    async addHighlight(docId: string, startOffset: number, endOffset: number, paraId?: number): Promise<AnnotationEntity> {
        const annotation: AnnotationEntity = {
            id: uuidv4(),
            docId,
            type: 'highlight',
            startOffset,
            endOffset,
            paraId,
            createdAt: Date.now()
        };

        await db.annotations.add(annotation);
        return annotation;
    }

    async addNote(docId: string, startOffset: number, endOffset: number, text: string, paraId?: number): Promise<AnnotationEntity> {
        const annotation: AnnotationEntity = {
            id: uuidv4(),
            docId,
            type: 'note',
            startOffset,
            endOffset,
            paraId,
            text,
            createdAt: Date.now()
        };

        await db.annotations.add(annotation);
        return annotation;
    }

    async getAnnotations(docId: string): Promise<AnnotationEntity[]> {
        return await db.annotations.where('docId').equals(docId).sortBy('startOffset');
    }

    async deleteAnnotation(id: string) {
        await db.annotations.delete(id);
    }
}

export const annotationStore = new AnnotationStore();
