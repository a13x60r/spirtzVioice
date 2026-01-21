import { OfflineVoice } from './tts/OfflineVoice';
import { pcmToWav } from './tts/AudioConverter';
import type { WorkerMessage, WorkerResponse, SynthesizeRequest, ChunkCompleteResponse } from './tts-protocol';

const ctx: Worker = self as any;
const ttsEngine = new OfflineVoice();

ctx.onmessage = async (event: MessageEvent<WorkerMessage>) => {
    const { type, payload } = event.data;

    try {
        switch (type) {
            case 'INIT':
                await ttsEngine.init();
                sendResponse('INIT_COMPLETE');
                break;

            case 'GET_VOICES':
                const voices = await ttsEngine.getVoices();
                sendResponse('VOICES_LIST', voices);
                break;

            case 'SYNTHESIZE_CHUNK':
                await handleSynthesize(payload as SynthesizeRequest);
                break;

            case 'LOAD_VOICE':
                const { voiceId } = payload;
                await ttsEngine.loadVoice(voiceId);
                sendResponse('VOICE_LOADED', { voiceId });
                break;

            default:
                console.warn('Unknown message type:', type);
        }
    } catch (error: any) {
        console.error('Worker error:', error);
        // Try to recover chunkHash from payload if possible, but payload scope is in try block.
        // It's defined above.
        ctx.postMessage({
            type: 'CHUNK_ERROR',
            error: error.message,
            payload: payload // Include original payload to identify chunk
        } as WorkerResponse);
    }
};

async function handleSynthesize(request: SynthesizeRequest) {
    const { chunkText, chunkHash, speedWpm } = request;

    // Synthesize using the engine
    const { audioData, sampleRate, durationSec, wavBuffer: preGeneratedWav } = await ttsEngine.synthesize(chunkText, speedWpm);

    // Convert Float32Array to WAV ArrayBuffer
    // Note: We might want to pass Float32Array directly if AudioBuffer decoding supports it, 
    // but WAV is safer for transport and storage validation.
    let wavBuffer: ArrayBuffer;

    if (preGeneratedWav) {
        wavBuffer = preGeneratedWav;
    } else {
        wavBuffer = pcmToWav(audioData, sampleRate);
    }

    const response: ChunkCompleteResponse = {
        chunkHash,
        audioData: wavBuffer,
        durationSec,
        sampleRate
    };

    // Transfer the buffer to avoid copying
    ctx.postMessage(
        {
            type: 'CHUNK_COMPLETE',
            payload: response
        } as WorkerResponse,
        [wavBuffer]
    );
}

function sendResponse(type: any, payload?: any) {
    ctx.postMessage({ type, payload } as WorkerResponse);
}
