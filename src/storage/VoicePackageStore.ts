import { db, type VoiceAssetEntity } from './Database';
import type { VoicePackage } from '@spec/types';

export class VoicePackageStore {
    /**
     * Install a voice package (metadata + assets)
     */
    async installVoice(metadata: VoicePackage, assets: Map<string, ArrayBuffer | Blob>): Promise<void> {
        await db.transaction('rw', db.voicePackages, db.voiceAssets, async () => {
            // 1. Save metadata
            await db.voicePackages.put(metadata);

            // 2. Save assets
            for (const [filename, data] of assets.entries()) {
                const assetId = `${metadata.voiceId}/${filename}`;
                await db.voiceAssets.put({
                    id: assetId,
                    voiceId: metadata.voiceId,
                    data
                } as VoiceAssetEntity);
            }
        });
    }

    /**
     * List all installed voices
     */
    async listVoices(): Promise<VoicePackage[]> {
        return await db.voicePackages.toArray();
    }

    /**
     * Get specific voice metadata
     */
    async getVoice(voiceId: string): Promise<VoicePackage | undefined> {
        return await db.voicePackages.get(voiceId);
    }

    /**
     * Load a specific asset for a voice
     */
    async getVoiceAsset(voiceId: string, filename: string): Promise<ArrayBuffer | Blob | undefined> {
        const assetId = `${voiceId}/${filename}`;
        const entry = await db.voiceAssets.get(assetId);
        return entry?.data;
    }

    /**
     * Check if a voice is fully installed (simple check)
     */
    async isVoiceInstalled(voiceId: string): Promise<boolean> {
        const meta = await this.getVoice(voiceId);
        if (!meta) return false;

        // Check if main assets exist?
        // For MVP, just existence of metadata assumes installation complete.
        return true;
    }

    /**
     * Uninstall a voice
     */
    async uninstallVoice(voiceId: string) {
        await db.transaction('rw', db.voicePackages, db.voiceAssets, async () => {
            await db.voicePackages.delete(voiceId);
            await db.voiceAssets.where('voiceId').equals(voiceId).delete();
        });
    }
}

export const voicePackageStore = new VoicePackageStore();
