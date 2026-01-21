import { AudioScheduler } from './AudioScheduler';
import { PlaybackController } from './PlaybackController';
import { PlanEngine } from '@domain/PlanEngine';
import { TimelineEngine } from '@domain/TimelineEngine';
import type { RenderPlan, Timeline, Token, Settings } from '@spec/types';
import type { ChunkCompleteResponse, WorkerResponse } from '@workers/tts-protocol';

/**
 * AudioEngine: Orchestrates the entire audio pipeline
 * - Generates Plan
 * - Manages TTS Worker
 * - Decodes Audio
 * - Builds Timeline
 * - Controls Playback
 */
export class AudioEngine {
    private scheduler: AudioScheduler;
    private controller: PlaybackController;
    private worker: Worker;

    private currentPlan: RenderPlan | null = null;
    private currentTimeline: Timeline | null = null;

    // Cache of decoded AudioBuffers
    private audioBufferCache = new Map<string, AudioBuffer>();

    // Pending resolver map for chunks
    private pendingChunks = new Map<string, { resolve: (response: ChunkCompleteResponse) => void, reject: (err: any) => void }>();
    // Pending resolver map for voice loads
    private pendingVoiceLoads = new Map<string, { resolve: () => void, reject: (err: Error) => void }>();

    constructor() {
        this.controller = new PlaybackController();
        this.scheduler = this.controller.getScheduler();

        // Initialize Worker
        this.worker = new Worker(new URL('../workers/tts-worker.ts', import.meta.url), {
            type: 'module'
        });

        this.worker.onmessage = this.handleWorkerMessage.bind(this);

        // Init worker
        this.worker.postMessage({ type: 'INIT' });
    }

    getController() {
        return this.controller;
    }

    /**
     * Load a document and prepare for playback
     */
    async loadDocument(
        docId: string,
        tokens: Token[],
        settings: Settings,
        _startTokenIndex: number = 0
    ) {
        // Clear previous schedule
        this.scheduler.clear();

        // Ensure voice is loaded
        console.log(`Loading voice ${settings.voiceId}...`);
        await this.loadVoice(settings.voiceId);

        console.log('Generating plan...');
        this.currentPlan = await PlanEngine.generatePlan(docId, tokens, settings);

        console.log('Synthesizing audio...');
        // In MVP, synthesize everything upfront or in batches.
        // For simplicity: Synthesize ALL chunks now.
        // In real app: buffer window.

        await this.synthesizeAllChunks(this.currentPlan);

        console.log('Building timeline...');
        // Create map of AudioAssets (mocking AudioAsset structure using buffers)
        // TimelineEngine needs duration.
        const audioAssets = new Map<string, any>(); // Using 'any' as AudioAsset interface mismatch with AudioBuffer

        // We need to map AudioBuffer to AudioAsset-like structure for TimelineEngine
        for (const chunk of this.currentPlan.chunks) {
            const buffer = this.audioBufferCache.get(chunk.chunkHash);
            if (buffer) {
                audioAssets.set(chunk.chunkHash, {
                    durationSec: buffer.duration,
                    // other fields irrelevant for timeline building
                });
            }
        }

        this.currentTimeline = TimelineEngine.buildTimeline(
            this.currentPlan,
            audioAssets as any, // Cast to map
            tokens
        );

        this.controller.setTimeline(this.currentTimeline);

        // Schedule all buffers
        // let startTime = 0;
        // for (const entry of this.currentTimeline.entries) {
        // Placeholder for future logic
        // }

        // Re-scheduling logic:
        // We need to schedule CHUNKS, not tokens.
        // Iterate chunks, find their start time on timeline (time of first WORD token in chunk).
        for (const chunk of this.currentPlan.chunks) {
            // Find the first token that has a timeline entry (word tokens only have entries)
            let entry = null;
            for (const tokenId of chunk.tokenIds) {
                entry = this.currentTimeline.entries.find(e => e.tokenId === tokenId);
                if (entry) break;
            }

            if (!entry || !this.audioBufferCache.has(chunk.chunkHash)) {
                continue;
            }

            const buffer = this.audioBufferCache.get(chunk.chunkHash)!;
            this.scheduler.scheduleChunk(chunk.chunkHash, buffer, entry.tStartSec);
        }
    }

    async loadVoice(voiceId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.pendingVoiceLoads.set(voiceId, { resolve, reject });
            this.worker.postMessage({
                type: 'LOAD_VOICE',
                payload: { voiceId }
            });
        });
    }

    private async synthesizeAllChunks(plan: RenderPlan) {
        const chunksToSynth = plan.chunks.filter(chunk => !this.audioBufferCache.has(chunk.chunkHash));

        // Process chunks SEQUENTIALLY because piper-api uses a shared worker
        // and parallel requests cause message conflicts
        for (const chunk of chunksToSynth) {
            await this.synthesizeChunk(chunk, plan);
        }
    }

    private async synthesizeChunk(chunk: any, plan: RenderPlan): Promise<void> {
        if (this.audioBufferCache.has(chunk.chunkHash)) return;

        return new Promise((resolve, reject) => {
            this.pendingChunks.set(chunk.chunkHash, {
                resolve: async (response) => {
                    try {
                        // Decode output
                        const audioBuffer = await this.scheduler.getAudioContext().decodeAudioData(response.audioData);
                        this.audioBufferCache.set(chunk.chunkHash, audioBuffer);
                        resolve();
                    } catch (e) {
                        console.error("Decode error", e);
                        reject(e);
                    }
                },
                reject: (err) => {
                    console.error("Chunk synthesis rejected", err);
                    reject(err);
                }
            });

            this.worker.postMessage({
                type: 'SYNTHESIZE_CHUNK',
                payload: {
                    chunkText: chunk.chunkText,
                    chunkHash: chunk.chunkHash,
                    voiceId: plan.voiceId,
                    speedWpm: plan.speedWpm
                }
            });
        });
    }

    private handleWorkerMessage(event: MessageEvent<WorkerResponse>) {
        const { type, payload, error } = event.data;
        switch (type) {
            case 'CHUNK_COMPLETE': {
                const resolver = this.pendingChunks.get(payload.chunkHash);
                if (resolver) {
                    resolver.resolve(payload);
                    this.pendingChunks.delete(payload.chunkHash);
                }
                break;
            }
            case 'CHUNK_ERROR': {
                if (payload && payload.chunkHash) {
                    const resolver = this.pendingChunks.get(payload.chunkHash);
                    if (resolver) {
                        resolver.reject(new Error(error || "Unknown Chunk Error"));
                        this.pendingChunks.delete(payload.chunkHash);
                    }
                } else {
                    console.error("Global Chunk Error (no hash)", error);
                }
                break;
            }
            case 'VOICE_LOADED': {
                const resolver = this.pendingVoiceLoads.get(payload.voiceId);
                if (resolver) {
                    resolver.resolve();
                    this.pendingVoiceLoads.delete(payload.voiceId);
                }
                break;
            }
            case 'VOICE_ERROR': {
                if (payload && payload.voiceId) {
                    const resolver = this.pendingVoiceLoads.get(payload.voiceId);
                    if (resolver) {
                        resolver.reject(new Error(error));
                        this.pendingVoiceLoads.delete(payload.voiceId);
                    }
                }
                break;
            }
            case 'VOICES_LIST': {
                if (this.pendingVoiceList) {
                    this.pendingVoiceList.resolve(payload);
                    this.pendingVoiceList = null;
                }
                break;
            }
        }
    }

    private pendingVoiceList: { resolve: (voices: { id: string, name: string }[]) => void, reject: (err: Error) => void } | null = null;

    async getAvailableVoices(): Promise<{ id: string, name: string }[]> {
        return new Promise((resolve, reject) => {
            if (this.pendingVoiceList) {
                // If already pending, maybe chain or reject? For MVP, just replace or queue.
                // Simpler: reject previous or just allow overwrite (might lose response)
                // Let's just overwrite for now.
            }
            this.pendingVoiceList = { resolve, reject };
            this.worker.postMessage({ type: 'GET_VOICES' });
        });
    }
}
