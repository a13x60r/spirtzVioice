

import { piperGenerate } from './piper-api';

const BASE_URL = '/piper/';

export class OfflineVoice {
    private currentModelUrl: string = BASE_URL + 'en_US-amy-medium.onnx';
    private currentConfigUrl: string = BASE_URL + 'en_US-amy-medium.onnx.json';
    private originUrl: string;

    constructor(originUrl: string = '') {
        this.originUrl = originUrl || '';
    }

    // Helper to convert relative path to absolute URL
    private toAbsoluteUrl(relativePath: string): string {
        // If we are in a worker, sometimes relative paths work better if they are base-absolute (starting with /)
        // But if originUrl is provided, we use it to ensure it's fully qualified for multi-worker contexts.
        if (this.originUrl && !relativePath.startsWith('http')) {
            // Ensure no double slashes if originUrl ends with / and relativePath starts with /
            const origin = this.originUrl.replace(/\/$/, '');
            const path = relativePath.startsWith('/') ? relativePath : '/' + relativePath;
            return origin + path;
        }
        return relativePath;
    }

    async init(): Promise<void> {
        console.log('OfflineVoice (Piper) initializing...');
        // Piper worker is lazy-loaded by piperGenerate typically, but we prepare here.
    }

    async getVoices(): Promise<{ id: string, name: string }[]> {
        // Hardcoded for now, as we only download Amy
        return [
            { id: 'en_US-amy-medium.onnx', name: 'Amy (Medium) - English US' }
        ];
    }

    async loadVoice(voiceId: string): Promise<void> {
        // Map voice IDs to actual model filenames
        const voiceMap: Record<string, string> = {
            'default': 'en_US-amy-medium.onnx',
            'en-us': 'en_US-amy-medium.onnx',
            'amy': 'en_US-amy-medium.onnx',
            'en_US-amy-medium.onnx': 'en_US-amy-medium.onnx'
        };

        const actualVoiceFile = voiceMap[voiceId] || 'en_US-amy-medium.onnx';
        this.currentModelUrl = BASE_URL + actualVoiceFile;
        this.currentConfigUrl = BASE_URL + actualVoiceFile + '.json';
        console.log(`Configured voice: ${voiceId} -> ${actualVoiceFile}`);

        // Warmup: Synthesize a tiny snippet to force download & cache of the model
        // This prevents race conditions when multiple workers try to fetch the 60MB file at once.
        console.log(`[OfflineVoice] Warming up voice ${voiceId}...`);
        try {
            await this.synthesize("Ready", 300);
            console.log(`[OfflineVoice] Warmup complete.`);
        } catch (e) {
            console.warn(`[OfflineVoice] Warmup failed (non-fatal if network issue persists, but likely to fail later):`, e);
        }
    }

    async synthesize(text: string, _speedWpm: number, useWebGPU: boolean = false, gpuPreference?: 'high-performance' | 'low-power' | 'default'): Promise<{
        audioData: Float32Array,
        sampleRate: number,
        durationSec: number,
        wavBuffer?: ArrayBuffer
    }> {
        // Piper uses on-disk models.
        // We need to pass the URLs.

        // Calculate length scale to adjust speed
        // Default WPM is approx 200? Amy is quite slow, maybe 150-180 default.
        // Let's assume baseline 1.0 is ~175 WPM.
        // speedWpm = 350 -> lengthScale = 0.5 (faster)
        const BASE_WPM = 175;
        const lengthScale = BASE_WPM / Math.max(50, _speedWpm); // Avoid div/0

        try {
            // Convert all paths to absolute URLs for Worker context
            const result = await piperGenerate(
                this.toAbsoluteUrl(BASE_URL + 'piper_phonemize.js'),
                this.toAbsoluteUrl(BASE_URL + 'piper_phonemize.wasm'),
                this.toAbsoluteUrl(BASE_URL + 'piper_phonemize.data'),
                this.toAbsoluteUrl(BASE_URL + 'piper_worker.js'),
                this.toAbsoluteUrl(this.currentModelUrl),
                this.toAbsoluteUrl(this.currentConfigUrl),
                null, // speakerId
                text,
                (_p) => { /* Silenced internal logs */ },
                null, // phonemeIds
                false, // inferEmotion
                this.toAbsoluteUrl(BASE_URL), // onnxruntimeUrl (folder)
                lengthScale,
                useWebGPU,
                gpuPreference
            );

            // result.file is a Blob (wav)
            const wavBlob = result.file;
            const wavBuffer = await wavBlob.arrayBuffer();

            // We return wavBuffer directly to the worker explanation
            // But the interface expects audioData (Float32Array) usually?
            // Let's look at tts-worker.ts usage.
            // tts-worker calls: const { audioData, sampleRate, durationSec } = await ttsEngine.synthesize...
            // then calls pcmToWav(audioData...).

            // IF we already have WAV, we should return it and skip pcmToWav.
            // But we need to update tts-worker.ts to handle this.

            // For now, let's decode the WAV header manually or just return dummy audioData and the real wavBuffer?
            // Correct approach: Return wavBuffer and update tts-worker to use it.

            return {
                audioData: new Float32Array(0), // Dummy
                sampleRate: 22050, // Default for Amy
                durationSec: result.duration / 1000,
                wavBuffer: wavBuffer
            };

        } catch (err) {
            console.error("Piper synthesis failed", err);
            throw err;
        }
    }
}
