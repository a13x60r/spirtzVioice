import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OfflineVoice } from '../OfflineVoice';
import { piperGenerate } from '../piper-api';

// Mock piper-wasm
vi.mock('../piper-api', () => ({
    piperGenerate: vi.fn().mockResolvedValue({
        file: new Blob([new ArrayBuffer(44)], { type: 'audio/wav' }), // Mock WAV Blob
        duration: 1000,
        phonemes: ['t', 'e', 's', 't']
    })
}));

// Mock Blob with arrayBuffer if environment doesn't have it
if (!Blob.prototype.arrayBuffer) {
    Blob.prototype.arrayBuffer = function () {
        return Promise.resolve(new ArrayBuffer(this.size));
    };
}

// Mock fetch for Blob/ArrayBuffer (though verified not used for result.file anymore)
global.fetch = vi.fn().mockResolvedValue({
    blob: () => {
        const b = new Blob([new ArrayBuffer(44)]);
        if (!b.arrayBuffer) {
            b.arrayBuffer = () => Promise.resolve(new ArrayBuffer(44));
        }
        return Promise.resolve(b);
    },
    ok: true
} as unknown as Response);

describe('OfflineVoice (Piper)', () => {
    let voice: OfflineVoice;

    beforeEach(() => {
        voice = new OfflineVoice();
        vi.clearAllMocks();
        vi.mocked(piperGenerate).mockResolvedValue({
            file: new Blob([new ArrayBuffer(44)], { type: 'audio/wav' }),
            duration: 1000,
            phonemes: ['t', 'e', 's', 't'],
            phonemeIds: [1, 2, 3, 4]
        });
    });

    it('should initialize successfully', async () => {
        await expect(voice.init()).resolves.not.toThrow();
    });

    it('should list available voices', async () => {
        const voices = await voice.getVoices();
        expect(voices.length).toBeGreaterThan(0);
        expect(voices.some((entry) => entry.id === 'en_US-amy-medium.onnx')).toBe(true);
        expect(voices.some((entry) => entry.id === 'ru_RU-dmitri-medium.onnx')).toBe(true);
    });

    it('should synthesize text and return audio data', async () => {
        const result = await voice.synthesize("Hello world", 150);

        expect(result).toBeDefined();
        // Since we return raw wavBuffer now
        expect(result.wavBuffer).toBeDefined();
        expect(result.wavBuffer?.byteLength).toBe(44);
        expect(result.durationSec).toBe(1);
    });

    it('passes the dist runtime folder to Piper worker', async () => {
        await voice.synthesize('Hello world', 150);

        expect(piperGenerate).toHaveBeenCalledTimes(1);
        expect(vi.mocked(piperGenerate).mock.calls[0][11]).toBe('/piper/dist/piper-dist/');
    });
});
