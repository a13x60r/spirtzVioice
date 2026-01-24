import { describe, it, expect, vi } from 'vitest';
import { OfflineVoice } from '../tts/OfflineVoice';

vi.mock('../tts/piper-api', () => ({
    piperGenerate: vi.fn().mockResolvedValue({
        file: new Blob([new ArrayBuffer(44)], { type: 'audio/wav' }),
        duration: 500,
        phonemes: ['t', 'e', 's', 't']
    })
}));

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
        expect(result.wavBuffer?.byteLength).toBe(44);
    });
});
