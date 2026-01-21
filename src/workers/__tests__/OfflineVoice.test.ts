import { describe, it, expect } from 'vitest';
import { OfflineVoice } from '../tts/OfflineVoice';

describe('OfflineVoice', () => {
    it('should fail initialization', async () => {
        const voice = new OfflineVoice();
        expect(voice).toBeDefined();
        await voice.init();
    });

    it('should list voices', async () => {
        const voice = new OfflineVoice();
        const voices = await voice.getVoices();
        expect(voices.length).toBeGreaterThan(0);
        expect(voices[0].id).toBeDefined();
    });

    it('should synthesize text', async () => {
        const voice = new OfflineVoice();
        const result = await voice.synthesize('Hello world', 150);

        expect(result.sampleRate).toBeGreaterThan(0);
        expect(result.durationSec).toBeGreaterThan(0);
        expect(result.audioData.length).toBeGreaterThan(0);

        // Check if duration matches samples
        const expectedSamples = Math.floor(result.durationSec * result.sampleRate);
        expect(result.audioData.length).toBe(expectedSamples);
    });
});
