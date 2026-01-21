import { describe, it, expect } from 'vitest';
import { pcmToWav } from '../tts/AudioConverter';

describe('AudioConverter', () => {
    it('should convert PCM to WAV', () => {
        const sampleRate = 44100;
        const pcmData = new Float32Array(sampleRate); // 1 second of silence

        const wavBuffer = pcmToWav(pcmData, sampleRate);
        const view = new DataView(wavBuffer);

        // Check RIFF header
        expect(String.fromCharCode(view.getUint8(0))).toBe('R');
        expect(String.fromCharCode(view.getUint8(1))).toBe('I');
        expect(String.fromCharCode(view.getUint8(2))).toBe('F');
        expect(String.fromCharCode(view.getUint8(3))).toBe('F');

        // Check WAVE fmt 
        expect(String.fromCharCode(view.getUint8(8))).toBe('W');
        expect(String.fromCharCode(view.getUint8(9))).toBe('A');
        expect(String.fromCharCode(view.getUint8(10))).toBe('V');
        expect(String.fromCharCode(view.getUint8(11))).toBe('E');

        // Check Sample Rate
        expect(view.getUint32(24, true)).toBe(sampleRate);

        // Check Metadata size
        // Header is 44 bytes
        // Data is 2 bytes per sample (16-bit)
        const expectedSize = 44 + (pcmData.length * 2);
        expect(wavBuffer.byteLength).toBe(expectedSize);
    });
});
