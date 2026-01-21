
// Local version of piper-wasm/api.js adapted to remove missing 'expressions.js' dependency

const blobs: Record<string, Blob> = {};

interface PiperGenerateResult {
    file: Blob;
    duration: number;
    phonemes: string[];
    phonemeIds: number[];
}


const MAX_WORKERS = 3;

class WorkerPool {
    private workers: Worker[] = [];
    private activeWorkers: Set<Worker> = new Set();

    getWorker(url: string): Worker {

        // Try to find an idle worker
        const idleWorker = this.workers.find(w => !this.activeWorkers.has(w));
        if (idleWorker) {
            this.activeWorkers.add(idleWorker);
            return idleWorker;
        }

        // Create new if limit not reached
        if (this.workers.length < MAX_WORKERS) {
            const newWorker = new Worker(url);
            this.workers.push(newWorker);
            this.activeWorkers.add(newWorker);
            return newWorker;
        }

        // Fallback: This shouldn't happen if AudioEngine concurrency matches pool size.
        // But if it does, just spawn a temporary one (or we could wait, but simple is better for now)
        console.warn("Worker pool exhausted, spawning temporary worker");
        return new Worker(url);
    }

    releaseWorker(worker: Worker) {
        if (this.workers.includes(worker)) {
            this.activeWorkers.delete(worker);
        } else {
            // It was a temp worker
            worker.terminate();
        }
    }
}

const pool = new WorkerPool();

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
    lengthScale?: number,
    useWebGPU: boolean = false
): Promise<PiperGenerateResult> => {
    let piperProgress = 0;

    if (inferEmotion) {
        console.warn("Emotion inference is not supported in this local adaptation of piper-wasm.");
    }

    return new Promise<PiperGenerateResult>(async (resolve, reject) => {
        const worker = pool.getWorker(workerUrl);

        const messageHandler = (event: MessageEvent) => {
            const data = event.data;
            switch (data.kind) {
                case "output": {
                    piperProgress = Math.round(100);
                    if (onProgress) onProgress(piperProgress);

                    cleanup();
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
                    cleanup();
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
        };

        const cleanup = () => {
            worker.removeEventListener("message", messageHandler);
            pool.releaseWorker(worker);
        };

        worker.addEventListener("message", messageHandler);

        // Optimizing CPU usage:
        // If we have 3 workers, we shouldn't let each consume all cores.
        // We split available cores among workers.
        const totalCores = navigator.hardwareConcurrency || 4;
        const threadsPerWorker = Math.max(1, Math.floor(totalCores / MAX_WORKERS));

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
            numThreads: threadsPerWorker,
            useWebGPU,
        });
    });
};

// Unused without Expressions
// const normalizeIpa = (ipa: string) => { ... }
