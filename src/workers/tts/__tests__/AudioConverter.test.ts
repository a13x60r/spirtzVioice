import { describe, it, expect } from 'vitest';
import { wavToPcm } from '../AudioConverter';
import { pcmToWav } from '../AudioConverter';

describe('AudioConverter', () => {
    it('should encode and decode PCM', () => {
        const sampleRate = 44100;
        const input = new Float32Array([0.5, -0.5, 0, 0.9, -0.9]);

        // Encode
        const wavBuffer = pcmToWav(input, sampleRate);
        expect(wavBuffer.byteLength).toBeGreaterThan(44);

        // Decode
        const result = wavToPcm(wavBuffer);

        expect(result.sampleRate).toBe(sampleRate);
        expect(result.audioData.length).toBe(input.length);

        // Check values (precision might vary due to 16-bit int conversion)
        for (let i = 0; i < input.length; i++) {
            expect(result.audioData[i]).toBeCloseTo(input[i], 2);
        }
    });
});
