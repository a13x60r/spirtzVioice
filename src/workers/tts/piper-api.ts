
// Local version of piper-wasm/api.js adapted to remove missing 'expressions.js' dependency

const blobs: Record<string, Blob> = {};

interface PiperGenerateResult {
    file: Blob;
    duration: number;
    phonemes: string[];
    phonemeIds: number[];
}


export const piperGenerate = async (
    piperPhonemizeJsUrl: string,
    piperPhonemizeWasmUrl: string,
    piperPhonemizeDataUrl: string,
    workerUrl: string,
    modelUrl: string,
    modelConfigUrl: string,
    speakerId: number | null,
    input: string,
    onProgress?: (progress: number) => void,
    phonemeIds?: number[] | null,
    inferEmotion: boolean = false,
    onnxruntimeUrl: string = "https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.17.1/",
    lengthScale?: number
): Promise<PiperGenerateResult> => {
    let piperProgress = 0;

    if (inferEmotion) {
        console.warn("Emotion inference is not supported in this local adaptation of piper-wasm.");
    }

    const piperPromise = new Promise<PiperGenerateResult>(async (resolve, reject) => {
        const worker = new Worker(workerUrl);

        worker.postMessage({
            kind: "init",
            input,
            speakerId,
            blobs,
            piperPhonemizeJsUrl,
            piperPhonemizeWasmUrl,
            piperPhonemizeDataUrl,
            modelUrl,
            modelConfigUrl,
            phonemeIds,
            onnxruntimeUrl,
            lengthScale,
        });

        worker.addEventListener("message", (event: MessageEvent) => {
            const data = event.data;
            switch (data.kind) {
                case "output": {
                    // const rawIpa = (data.phonemes as string[]).join(" ");
                    // const ipa = normalizeIpa(rawIpa); // unused

                    piperProgress = Math.round(100);
                    if (onProgress) onProgress(piperProgress);

                    worker.terminate();
                    resolve({
                        file: data.file,
                        duration: data.duration,
                        phonemes: data.phonemes,
                        phonemeIds: data.phonemeIds
                    });
                    break;
                }
                case "stderr": {
                    console.error(data.message);
                    worker.terminate();
                    reject(new Error(data.message));
                    break;
                }
                case "fetch": {
                    if (data.blob) blobs[data.url] = data.blob;
                    const progress = data.blob
                        ? 1
                        : data.total
                            ? data.loaded / data.total
                            : 0;
                    piperProgress = Math.round(progress * 100);
                    if (onProgress) onProgress(piperProgress);
                    break;
                }
            }
        });
    });

    return piperPromise;
};

// Unused without Expressions
// const normalizeIpa = (ipa: string) => { ... }
