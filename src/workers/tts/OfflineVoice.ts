

import { piperGenerate } from './piper-api';

const BASE_URL = '/piper/';

export class OfflineVoice {
    private currentModelUrl: string = BASE_URL + 'en_US-amy-medium.onnx';
    private currentConfigUrl: string = BASE_URL + 'en_US-amy-medium.onnx.json';

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
    }

    async synthesize(text: string, _speedWpm: number): Promise<{
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
            const result = await piperGenerate(
                BASE_URL + 'piper_phonemize.js',
                BASE_URL + 'piper_phonemize.wasm',
                BASE_URL + 'piper_phonemize.data',
                BASE_URL + 'piper_worker.js',
                this.currentModelUrl,
                this.currentConfigUrl,
                null, // speakerId
                text,
                (_progress) => { /* console.log('Piper Progress', progress) */ },
                null, // phonemeIds
                false, // inferEmotion
                BASE_URL, // onnxruntimeUrl (folder)
                lengthScale
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
