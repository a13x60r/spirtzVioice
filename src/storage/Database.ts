import Dexie, { type Table } from 'dexie';
import type { Settings, AudioAsset, RenderPlan, Timeline, VoicePackage } from '@spec/types';

// Entity Interfaces for Database
export interface DocumentEntity {
    id: string; // uuid
    title: string;
    originalText: string;
    createdAt: number;
    lastReadAt: number;
    progressTokenIndex: number;
    voiceId: string; // Last used voice
    speedWpm: number; // Last used speed
}

export interface SettingsEntity extends Settings {
    id: string; // 'user_settings' (singleton)
}

export interface AudioAssetEntity extends AudioAsset {
    // chunks are identified by hash
    id: string; // chunkHash
}

export interface PlanEntity extends RenderPlan {
    // planId is key
}

export interface TimelineEntity extends Timeline {
    // planId is key
}

export class AppDatabase extends Dexie {
    documents!: Table<DocumentEntity, string>;
    settings!: Table<SettingsEntity, string>;
    audioCache!: Table<AudioAssetEntity, string>;
    plans!: Table<PlanEntity, string>;
    timelines!: Table<TimelineEntity, string>;
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
    }
}

export const db = new AppDatabase();

export interface VoiceAssetEntity {
    id: string; // voiceId/filename
    voiceId: string;
    data: ArrayBuffer | Blob;
}
