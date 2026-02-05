import { db, type SettingsEntity } from './Database';
import type { Settings } from '@spec/types';

const SETTINGS_KEY = 'user_settings';

const DEFAULT_SETTINGS: Settings = {
    voiceId: 'default',
    speedWpm: 250,
    strategy: 'CHUNK',
    chunkSize: 8,
    lookaheadSec: 20,
    mode: 'RSVP',
    pauseRules: {
        punctPauseMs: 400,
        paragraphPauseMs: 600
    },
    tokenizerVersion: '1',
    playbackRate: 1.0,
    textSize: 1.0,
    theme: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default',
    readerFontFamily: 'literata',
    readerLineHeight: 1.6,
    orpEnabled: true,
    orpIntensity: 1.0,
    darkMode: undefined,
    language: 'en-US',
    skipSettings: {
        seekSec: 10,
        wordCount: 1,
        sentenceCount: 1,
        paragraphCount: 1,
        mediaSkipBackUnit: 'paragraph',
        mediaSkipFwdUnit: 'paragraph'
    }
};

export class SettingsStore {
    /**
     * Load user settings or create defaults
     */
    async loadSettings(): Promise<Settings> {
        const saved = await db.settings.get(SETTINGS_KEY);
        if (!saved) {
            const initial: SettingsEntity = {
                id: SETTINGS_KEY,
                ...DEFAULT_SETTINGS
            };
            await db.settings.add(initial);
            return DEFAULT_SETTINGS;
        }

        // Merge with defaults to handle new fields in future
        const merged = { ...DEFAULT_SETTINGS, ...saved };
        if (!merged.theme && merged.darkMode) {
            merged.theme = 'dark';
        }
        return merged;
    }

    /**
     * Save user settings
     */
    async saveSettings(settings: Partial<Settings>) {
        // We only update fields provided, keeping existing
        const current = await this.loadSettings();
        const updated: SettingsEntity = {
            id: SETTINGS_KEY,
            ...current,
            ...settings
        };

        await db.settings.put(updated);
    }
}

export const settingsStore = new SettingsStore();
