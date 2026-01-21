declare module 'mespeak' {
    export interface SpeakOptions {
        amplitude?: number;
        pitch?: number;
        speed?: number;
        voice?: string;
        wordgap?: number;
        volume?: number;
        rawdata?: boolean | 'buffer' | 'float32';
    }

    export function loadConfig(config: any): void;
    export function loadVoice(voice: any): void;
    export function speak(text: string, options?: SpeakOptions): ArrayBuffer | Uint8Array | Float32Array;
    export function canPlay(): boolean;
}
