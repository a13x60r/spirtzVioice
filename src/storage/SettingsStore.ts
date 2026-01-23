import { db, type SettingsEntity } from './Database';
import type { Settings } from '@spec/types';

const SETTINGS_KEY = 'user_settings';

const DEFAULT_SETTINGS: Settings = {
    voiceId: 'default',
    speedWpm: 250,
    strategy: 'TOKEN',
    chunkSize: 5,
    lookaheadSec: 20,
    mode: 'RSVP',
    pauseRules: {
        punctPauseMs: 400,
        paragraphPauseMs: 600
    },
    tokenizerVersion: '1',
    playbackRate: 1.0,
    textSize: 1.0,
    darkMode: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches,
    language: 'en-US'
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
        return { ...DEFAULT_SETTINGS, ...saved };
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
