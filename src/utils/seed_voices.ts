import { voicePackageStore } from '../storage/VoicePackageStore';
import { VoicePackage } from '@spec/types';

export async function seedMockVoices() {
    const existing = await voicePackageStore.listVoices();
    if (existing.length > 1) {
        console.log("Voices already seeded.");
        return;
    }

    const voices: VoicePackage[] = [
        {
            voiceId: 'mock-robot',
            name: 'Robot Voice (Mock)',
            lang: 'en-US',
            version: '1.0',
            sizeBytes: 1024,
            assets: []
        },
        {
            voiceId: 'mock-alien',
            name: 'Alien Voice (Mock)',
            lang: 'en-US',
            version: '1.0',
            sizeBytes: 1024,
            assets: []
        },
        {
            voiceId: 'mock-deep',
            name: 'Deep Voice (Mock)',
            lang: 'en-US',
            version: '1.0',
            sizeBytes: 1024,
            assets: []
        }
    ];

    for (const v of voices) {
        // We don't strictly need real assets for the mock engine.
        // It just checks voiceId.
        await voicePackageStore.installVoice(v, new Map());
        console.log(`Seeded voice: ${v.name}`);
    }
}
