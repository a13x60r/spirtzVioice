import { db, type DocumentEntity } from './Database';
import { v4 as uuidv4 } from 'uuid';

export class DocumentStore {
    /**
     * Create a new document
     */
    async createDocument(title: string, originalText: string, ttsText?: string, contentType: 'text' | 'html' | 'markdown' = 'text', totalTokens?: number, language?: string): Promise<DocumentEntity> {
        const doc: DocumentEntity = {
            id: uuidv4(),
            title,
            originalText,
            contentType,
            ttsText: ttsText || originalText, // Fallback to originalText if no ttsText provided
            totalTokens,
            language,
            createdAt: Date.now(),
            lastReadAt: Date.now(),
            lastUpdated: Date.now(),
            progressTokenIndex: 0,
            progressOffset: 0,
            progressChunkIndex: 0,
            progressParaId: 0,
            progressScrollTop: 0,
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
    async updateProgress(id: string, tokenIndex: number, speedWpm?: number, mode?: 'RSVP' | 'PARAGRAPH' | 'FOCUS') {
        await this.updateReadingState(id, {
            progressTokenIndex: tokenIndex,
            speedWpm,
            mode
        });
    }

    /**
     * Update detailed reading state
     */
    async updateReadingState(id: string, state: {
        progressTokenIndex: number;
        progressOffset?: number;
        progressChunkIndex?: number;
        progressParaId?: number;
        progressScrollTop?: number;
        speedWpm?: number;
        mode?: 'RSVP' | 'PARAGRAPH' | 'FOCUS';
    }) {
        const updateData: Partial<DocumentEntity> = {
            progressTokenIndex: state.progressTokenIndex,
            lastReadAt: Date.now(),
            lastUpdated: Date.now()
        };

        if (state.progressOffset !== undefined) updateData.progressOffset = state.progressOffset;
        if (state.progressChunkIndex !== undefined) updateData.progressChunkIndex = state.progressChunkIndex;
        if (state.progressParaId !== undefined) updateData.progressParaId = state.progressParaId;
        if (state.progressScrollTop !== undefined) updateData.progressScrollTop = state.progressScrollTop;
        if (state.speedWpm !== undefined) updateData.speedWpm = state.speedWpm;
        if (state.mode !== undefined) updateData.mode = state.mode;

        await db.documents.update(id, updateData);
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
     * Delete multiple documents and related data
     */
    async bulkDeleteDocuments(ids: string[]) {
        if (ids.length === 0) return;

        await db.transaction('rw', db.documents, db.plans, db.timelines, async () => {
            // Find all planIds for all documents
            const plans = await db.plans.where('docId').anyOf(ids).toArray();
            const planIds = plans.map(p => p.planId);

            // Cleanup related plans/timelines
            await db.plans.where('docId').anyOf(ids).delete();
            await db.timelines.bulkDelete(planIds);

            // Finally delete documents
            await db.documents.bulkDelete(ids);
        });
    }
}

export const documentStore = new DocumentStore();
