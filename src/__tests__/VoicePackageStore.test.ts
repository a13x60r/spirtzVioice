import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { voicePackageStore } from '@storage/VoicePackageStore';
import { db } from '@storage/Database';
import type { VoicePackage } from '@spec/types';

describe('VoicePackageStore', () => {
    beforeEach(async () => {
        await db.voicePackages.clear();
        await db.voiceAssets.clear();
    });

    it('should install and retrieve a voice package', async () => {
        const metadata: VoicePackage = {
            voiceId: 'test-voice-1',
            name: 'Test Voice',
            lang: 'en-US',
            version: '1.0',
            sizeBytes: 1024,
            assets: ['model.onnx', 'config.json']
        };

        const assets = new Map<string, ArrayBuffer>();
        assets.set('model.onnx', new ArrayBuffer(100));
        assets.set('config.json', new ArrayBuffer(50));

        await voicePackageStore.installVoice(metadata, assets);

        // Verify list
        const voices = await voicePackageStore.listVoices();
        expect(voices).toHaveLength(1);
        expect(voices[0].voiceId).toBe('test-voice-1');

        // Verify asset retrieval
        const modelData = await voicePackageStore.getVoiceAsset('test-voice-1', 'model.onnx');
        expect(modelData).toBeDefined();
        if (modelData instanceof ArrayBuffer) {
            expect(modelData.byteLength).toBe(100);
        } else if (modelData instanceof Blob) {
            expect(modelData.size).toBe(100);
        }

        const missing = await voicePackageStore.getVoiceAsset('test-voice-1', 'missing.file');
        expect(missing).toBeUndefined();
    });

    it('should uninstall a voice', async () => {
        const metadata: VoicePackage = {
            voiceId: 'del-voice',
            name: 'Delete Me',
            lang: 'en-US',
            version: '1.0',
            sizeBytes: 100,
            assets: ['file.bin']
        };
        const assets = new Map<string, ArrayBuffer>();
        assets.set('file.bin', new ArrayBuffer(10));

        await voicePackageStore.installVoice(metadata, assets);
        expect(await voicePackageStore.getVoice('del-voice')).toBeDefined();

        await voicePackageStore.uninstallVoice('del-voice');
        expect(await voicePackageStore.getVoice('del-voice')).toBeUndefined();

        // Check asset cleanup
        const asset = await voicePackageStore.getVoiceAsset('del-voice', 'file.bin');
        expect(asset).toBeUndefined();
    });
});
