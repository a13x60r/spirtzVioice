import Dexie, { type Table } from 'dexie';
import type { Settings, AudioAsset, RenderPlan, Timeline, VoicePackage } from '@spec/types';

// Entity Interfaces for Database
export interface DocumentEntity {
    id: string; // uuid
    title: string;
    originalText: string;
    ttsText?: string; // Cleaned text for TTS (markdown/HTML stripped)
    createdAt: number;
    lastReadAt: number;
    lastUpdated?: number;
    progressTokenIndex: number;
    progressOffset?: number;
    progressChunkIndex?: number;
    progressParaId?: number;
    progressScrollTop?: number;
    voiceId: string; // Last used voice
    speedWpm: number; // Last used speed
    contentType: 'text' | 'html' | 'markdown';
    mode?: 'RSVP' | 'PARAGRAPH' | 'FOCUS';
    totalTokens?: number; // Total token count for accurate progress
    language?: string; // ISO language code detected or manual
}

export interface SettingsEntity extends Settings {
    id: string; // 'user_settings' (singleton)
    playbackRate?: number; // Persisted playback rate
}

export interface AudioAssetEntity extends AudioAsset {
    // chunks are identified by hash
    id: string; // chunkHash
}

export interface AudioChunkEntity {
    id: string; // chunkHash
    data: Blob; // WAV data
    duration: number; // seconds
}

export interface PlanEntity extends RenderPlan {
    // planId is key
}

export interface TimelineEntity extends Timeline {
    // planId is key
}

export interface SegmentCacheEntity {
    id: string; // docId:paraId
    docId: string;
    paraId: number;
    paragraphHash: string;
    chunks: {
        text: string;
        startOffset: number;
        endOffset: number;
        sentenceId: number;
        paraId: number;
    }[];
    createdAt: number;
    lastUpdated: number;
}

export interface AnnotationEntity {
    id: string; // uuid
    docId: string;
    type: 'highlight' | 'note';
    startOffset: number;
    endOffset: number;
    paraId?: number;
    text?: string;
    createdAt: number;
}

export class AppDatabase extends Dexie {
    documents!: Table<DocumentEntity, string>;
    settings!: Table<SettingsEntity, string>;
    audioCache!: Table<AudioAssetEntity, string>;
    audioChunks!: Table<AudioChunkEntity, string>;
    plans!: Table<PlanEntity, string>;
    timelines!: Table<TimelineEntity, string>;
    segmentCache!: Table<SegmentCacheEntity, string>;
    annotations!: Table<AnnotationEntity, string>;
    voicePackages!: Table<VoicePackage, string>;
    voiceAssets!: Table<VoiceAssetEntity, string>;

    constructor() {
        super('SpirtzVoiceDB');

        this.version(1).stores({
            documents: 'id, title, lastReadAt',
            settings: 'id',
            audioCache: 'id, lastAccessMs, chunkHash', // chunkHash is alias for id
            plans: 'planId, docId',
            timelines: 'planId',
            voicePackages: 'voiceId, lang',
            voiceAssets: 'id, voiceId'
        });

        this.version(2).stores({
            audioChunks: 'id' // chunkHash
        });

        // Version 3: Clear corrupted cache (reset audio)
        this.version(3).stores({}).upgrade(tx => {
            return tx.table('audioChunks').clear();
        });

        // Version 4: Add language field to documents
        this.version(4).stores({
            documents: 'id, title, lastReadAt, language'
        });

        // Version 5: Persist reading state offsets
        this.version(5).stores({
            documents: 'id, title, lastReadAt, language, lastUpdated'
        }).upgrade(tx => {
            return tx.table('documents').toCollection().modify(doc => {
                if (!doc.lastUpdated) doc.lastUpdated = doc.lastReadAt || Date.now();
            });
        });

        // Version 6: Cache segmentation results per paragraph
        this.version(6).stores({
            segmentCache: 'id, docId, paraId'
        });

        // Version 7: Annotations (highlights/notes)
        this.version(7).stores({
            annotations: 'id, docId, startOffset'
        });

        // Version 8: Add paraId index to annotations
        this.version(8).stores({
            annotations: 'id, docId, startOffset, paraId'
        });

        // Version 9: Re-declare full schema to preserve voice packages
        this.version(9).stores({
            documents: 'id, title, lastReadAt, language, lastUpdated',
            settings: 'id',
            audioCache: 'id, lastAccessMs, chunkHash',
            audioChunks: 'id',
            plans: 'planId, docId',
            timelines: 'planId',
            voicePackages: 'voiceId, lang',
            voiceAssets: 'id, voiceId',
            segmentCache: 'id, docId, paraId',
            annotations: 'id, docId, startOffset, paraId'
        });
    }

    async resetDatabase() {
        await this.transaction('rw', this.tables, async () => {
            await Promise.all(this.tables.map(table => table.clear()));
        });
        window.location.reload();
    }
}

export const db = new AppDatabase();

export interface VoiceAssetEntity {
    id: string; // voiceId/filename
    voiceId: string;
    data: ArrayBuffer | Blob;
}
