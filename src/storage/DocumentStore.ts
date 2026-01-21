import { db, type DocumentEntity } from './Database';
import { v4 as uuidv4 } from 'uuid';

export class DocumentStore {
    /**
     * Create a new document
     */
    async createDocument(title: string, originalText: string): Promise<DocumentEntity> {
        const doc: DocumentEntity = {
            id: uuidv4(),
            title,
            originalText,
            createdAt: Date.now(),
            lastReadAt: Date.now(),
            progressTokenIndex: 0,
            voiceId: 'default',
            speedWpm: 200 // Default speed
        };

        await db.documents.add(doc);
        return doc;
    }

    /**
     * Get all documents ordered by last read
     */
    async getAllDocuments(): Promise<DocumentEntity[]> {
        return await db.documents.orderBy('lastReadAt').reverse().toArray();
    }

    /**
     * Get a single document by ID
     */
    async getDocument(id: string): Promise<DocumentEntity | undefined> {
        return await db.documents.get(id);
    }

    /**
     * Update reading progress
     */
    async updateProgress(id: string, tokenIndex: number) {
        await db.documents.update(id, {
            progressTokenIndex: tokenIndex,
            lastReadAt: Date.now()
        });
    }

    /**
     * Update settings for a document (voice/speed)
     */
    async updateSettings(id: string, voiceId: string, speedWpm: number) {
        await db.documents.update(id, {
            voiceId,
            speedWpm,
            lastReadAt: Date.now()
        });
    }

    /**
     * Delete document and related data
     */
    async deleteDocument(id: string) {
        await db.transaction('rw', db.documents, db.plans, db.timelines, async () => {
            // Cleanup related plans/timelines
            await db.plans.where('docId').equals(id).delete();
            // Timelines are keyed by planId, but we don't have a direct docId index on timelines in the schema
            // Actually schema says: timelines: 'planId'
            // We can iterate plans before deleting to get planIds?
            // Or just leave them orphaned? Better to clean up.

            // Since plans table has docId, we can find planIds first
            const plans = await db.plans.where('docId').equals(id).toArray();
            const planIds = plans.map(p => p.planId);

            await db.timelines.bulkDelete(planIds);

            // Finally delete document
            await db.documents.delete(id);
        });
    }
}

export const documentStore = new DocumentStore();
