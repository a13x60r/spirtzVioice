/**
 * Protocol definitions for communication between Main thread and TTS Worker
 */

export type WorkerMessageType =
    | 'INIT'
    | 'SYNTHESIZE_CHUNK'
    | 'CANCEL'
    | 'GET_VOICES'
    | 'LOAD_VOICE';

export interface WorkerMessage {
    type: WorkerMessageType;
    payload?: any;
}

export type WorkerResponseType =
    | 'INIT_COMPLETE'
    | 'CHUNK_COMPLETE'
    | 'CHUNK_ERROR'
    | 'VOICES_LIST'
    | 'PROGRESS'
    | 'VOICE_LOADED'
    | 'VOICE_ERROR';

export interface WorkerResponse {
    type: WorkerResponseType;
    payload?: any;
    error?: string;
}

export interface SynthesizeRequest {
    chunkText: string;
    chunkHash: string;
    voiceId: string;
    speedWpm: number;
    useWebGPU?: boolean;
    gpuPreference?: 'high-performance' | 'low-power' | 'default';
}

export interface ChunkCompleteResponse {
    chunkHash: string;
    audioData: ArrayBuffer;
    durationSec: number;
    sampleRate: number;
}

export interface LoadVoiceRequest {
    voiceId: string;
    assets?: {
        model: ArrayBuffer | Blob;
        config: ArrayBuffer | Blob;
    };
}
