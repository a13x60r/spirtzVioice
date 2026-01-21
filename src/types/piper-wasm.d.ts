declare module 'piper-wasm' {
    export function piperGenerate(
        piperPhonemizeJsUrl: string,
        piperPhonemizeWasmUrl: string,
        piperPhonemizeDataUrl: string,
        workerUrl: string,
        modelUrl: string,
        modelConfigUrl: string,
        speakerId: number | null,
        input: string,
        onProgress: (progress: number) => void,
        phonemeIds: number[] | null,
        inferEmotion: boolean,
        onnxruntimeUrl: string
    ): Promise<{
        file: string; // Blob URL
        duration: number;
        phonemes: string[];
    }>;
}
