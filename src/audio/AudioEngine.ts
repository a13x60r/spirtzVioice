import { audioStore } from '../storage/AudioStore';
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
    private currentTokens: Token[] = [];
    private useWebGPU: boolean = false;
    private gpuPreference?: 'high-performance' | 'low-power' | 'default';

    // Pending resolver map for chunks
    private pendingChunks = new Map<string, { resolve: (response: ChunkCompleteResponse) => void, reject: (err: any) => void }>();
    // Pending resolver map for voice loads
    private pendingVoiceLoads = new Map<string, { resolve: () => void, reject: (err: Error) => void }>();

    // Track currently buffered chunks to prevent duplicates
    private bufferedChunks = new Set<string>();

    // Optimized timeline for chunks { hash, start, end }
    private chunkTimeline: { chunkHash: string, startSec: number, endSec: number }[] = [];

    // Shared context for metadata decoding (lightweight)
    private metadataCtx = new OfflineAudioContext(1, 1, new AudioContext().sampleRate);

    constructor() {
        this.controller = new PlaybackController();
        this.scheduler = this.controller.getScheduler();

        // Initialize Worker
        this.worker = new Worker(new URL('../workers/tts-worker.ts', import.meta.url), {
            type: 'module'
        });

        this.worker.onmessage = this.handleWorkerMessage.bind(this);

        // Init worker with origin URL for proper resource resolution
        this.worker.postMessage({ type: 'INIT', payload: { originUrl: window.location.origin } });

        // JIT Buffering Hook
        this.controller.onBufferingRequest = (time) => {
            this.bufferWindow(time).catch(console.warn);
        };
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
        _startTokenIndex: number = 0,
        onProgress?: (percent: number, message?: string) => void
    ) {
        this.currentTokens = tokens;
        this.useWebGPU = settings.useWebGPU ?? false;
        this.gpuPreference = settings.gpuPreference;
        this.bufferedChunks.clear();

        // Clear previous schedule
        this.scheduler.clear();

        // Ensure voice is loaded
        console.log(`Loading voice ${settings.voiceId}...`);
        await this.loadVoice(settings.voiceId);

        console.log('Generating plan...');
        // Create Plan
        const plan = await PlanEngine.generatePlan(docId, tokens, settings);
        this.currentPlan = plan;

        // Apply playback rate
        if (settings.playbackRate) {
            this.scheduler.setPlaybackRate(settings.playbackRate);
        }

        // Check if we have a timeline already (or partial) matches this plan?
        console.log('Synthesizing audio...');
        // In MVP, synthesize everything upfront or in batches.
        // For simplicity: Synthesize ALL chunks now.
        // In real app: buffer window.

        await this.synthesizeAllChunks(this.currentPlan, onProgress);

        console.log('Building timeline...');

        // Fetch durations for timeline building
        const audioAssets = new Map<string, any>();

        if (!this.currentPlan) return;

        // Parallel fetch of durations
        await Promise.all(this.currentPlan.chunks.map(async chunk => {
            const dur = await audioStore.getDuration(chunk.chunkHash);
            if (dur) {
                audioAssets.set(chunk.chunkHash, { durationSec: dur });
            }
        }));

        this.currentTimeline = TimelineEngine.buildTimeline(
            this.currentPlan,
            audioAssets as any,
            tokens
        );

        // Build Optimized Chunk Timeline
        this.chunkTimeline = [];
        let missingEntries = 0;
        let cumulativeTime = 0;

        for (const chunk of this.currentPlan.chunks) {
            const firstTokenId = chunk.tokenIds[0];
            const entry = this.currentTimeline.entries.find(e => e.tokenId === firstTokenId);
            const duration = await audioStore.getDuration(chunk.chunkHash) || 0;

            if (entry) {
                this.chunkTimeline.push({
                    chunkHash: chunk.chunkHash,
                    startSec: entry.tStartSec,
                    endSec: entry.tStartSec + duration
                });
            } else {
                // Fallback: Use cumulative time if entry not found
                console.warn(`[ChunkTimeline] No entry for chunk ${chunk.chunkHash.substring(0, 6)}, tokenId=${firstTokenId}, using cumulative time ${cumulativeTime.toFixed(2)}s`);
                this.chunkTimeline.push({
                    chunkHash: chunk.chunkHash,
                    startSec: cumulativeTime,
                    endSec: cumulativeTime + duration
                });
                missingEntries++;
            }
            cumulativeTime += duration;
        }

        // Sort just in case (though plan order should preserve it)
        this.chunkTimeline.sort((a, b) => a.startSec - b.startSec);

        console.log(`[ChunkTimeline] Built: ${this.chunkTimeline.length} chunks from ${this.currentPlan.chunks.length} plan chunks. Missing entries: ${missingEntries}`);

        this.controller.setTimeline(this.currentTimeline);

        // Initial buffering for start (or startTokenIndex time)
        // Find start time for token
        let startTime = 0;
        if (_startTokenIndex > 0) {
            const entry = this.currentTimeline.entries.find(e => e.tokenIndex === _startTokenIndex);
            if (entry) startTime = entry.tStartSec;
        }

        console.log(`Buffering initial window from ${startTime}s...`);
        await this.bufferWindow(startTime);

        // Ensure controller and UI are synced to the saved position
        if (_startTokenIndex > 0) {
            this.controller.seekByToken(_startTokenIndex);
        }
    }

    /**
     * JIT Buffering: Ensure audio is scheduled for [time, time + window]
     * Uses pre-built chunkTimeline for O(N) iteration.
     */
    async bufferWindow(startTime: number) {
        if (!this.currentTimeline || !this.currentPlan || this.chunkTimeline.length === 0) return;

        // Prune old chunks from scheduler memory
        this.scheduler.pruneBefore(startTime - 10);

        const WINDOW_SIZE = 30; // seconds ahead to buffer
        const endTime = startTime + WINDOW_SIZE;

        // Collect chunks to buffer
        const toBuffer: typeof this.chunkTimeline = [];

        for (const item of this.chunkTimeline) {
            if (item.endSec < startTime) continue;
            if (item.startSec > endTime) break;

            // Skip if already in buffer tracking OR already in scheduler queue
            if (this.bufferedChunks.has(item.chunkHash)) continue;
            if (this.scheduler.hasChunk(item.chunkHash)) {
                this.bufferedChunks.add(item.chunkHash);
                continue;
            }

            this.bufferedChunks.add(item.chunkHash);
            toBuffer.push(item);
        }

        // Process with limited parallelism (3 concurrent) to avoid CPU flooding
        const BATCH_SIZE = 3;
        for (let i = 0; i < toBuffer.length; i += BATCH_SIZE) {
            const batch = toBuffer.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (item) => {
                try {
                    await this.scheduleChunkFromStore(item.chunkHash, item.startSec);
                } catch (e) {
                    console.warn("Buffer failed for", item.chunkHash, e);
                    this.bufferedChunks.delete(item.chunkHash);
                }
            }));
        }

        // Clean up old entries from tracking set
        for (const item of this.chunkTimeline) {
            if (item.endSec < startTime - 20) {
                this.bufferedChunks.delete(item.chunkHash);
            }
            if (item.startSec > startTime) break;
        }
    }

    // Fetches from DB, Decodes, Schedules
    private async scheduleChunkFromStore(chunkHash: string, startTime: number) {
        const chunkEntity = await audioStore.getChunk(chunkHash);
        if (!chunkEntity) {
            console.warn(`[JIT] Chunk ${chunkHash} not in DB!`);
            return;
        }

        // Decode
        // Optimization: Browser checks cache for decodeAudioData of same ArrayBuffer? Not guaranteed.
        // We strictly relay on JIT. 
        try {
            const arrayBuffer = await chunkEntity.data.arrayBuffer();
            const ctx = this.scheduler.getAudioContext();

            // Decode
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            console.log(`[JIT] Sched ${chunkHash.substring(0, 6)} @ ${startTime.toFixed(2)}s dur=${audioBuffer.duration.toFixed(2)}s`);
            this.scheduler.scheduleChunk(chunkHash, audioBuffer, startTime);
        } catch (e) {
            console.warn(`Failed to decode chunk ${chunkHash}`, e);
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

    private async synthesizeAllChunks(plan: RenderPlan, onProgress?: (percent: number, message?: string) => void) {
        // Filter out chunks that are already in DB
        const chunksToSynth: any[] = [];

        // Batch check DB
        await Promise.all(plan.chunks.map(async chunk => {
            const exists = await audioStore.hasChunk(chunk.chunkHash);
            if (!exists) chunksToSynth.push(chunk);
        }));

        const total = chunksToSynth.length;

        if (total === 0) {
            onProgress?.(100, 'All chunks cached');
            return;
        }

        onProgress?.(0, `Synthesizing 0/${total} chunks...`);

        const CONCURRENCY = 3;
        let completed = 0;

        const processChunk = async (chunk: any) => {
            await this.synthesizeChunk(chunk, plan);
            completed++;
            onProgress?.(Math.round((completed / total) * 100), `Synthesizing chunk ${completed}/${total}...`);
        };

        // Process in batches
        for (let i = 0; i < total; i += CONCURRENCY) {
            const batch = chunksToSynth.slice(i, i + CONCURRENCY);
            await Promise.all(batch.map((chunk) => processChunk(chunk)));
        }
    }

    private async synthesizeChunk(chunk: any, plan: RenderPlan): Promise<void> {
        // Double check cache
        if (await audioStore.hasChunk(chunk.chunkHash)) return;

        return new Promise((resolve, reject) => {
            this.pendingChunks.set(chunk.chunkHash, {
                resolve: async (response) => {
                    try {
                        // Store Blob in DB
                        // We need the duration for the timeline. 
                        // Protocol sends audioData as ArrayBuffer.
                        // We decode it to get duration, then save Blob + Duration.

                        // Note: decodeAudioData detaches the buffer, so we might need to slice it if we want to save it too.
                        // Actually, we can just save the specific wav buffer if protocol provides it, 
                        // or create blob from response.audioData.

                        // Decode to get accurate duration
                        // We use the shared OfflineAudioContext to avoid creating many contexts
                        // decodeAudioData detaches the buffer, so we slice it
                        const audioBuffer = await this.metadataCtx.decodeAudioData(response.audioData.slice(0));
                        const duration = audioBuffer.duration;

                        const blob = new Blob([response.audioData], { type: 'audio/wav' });
                        await audioStore.saveChunk(chunk.chunkHash, blob, duration);

                        resolve();
                    } catch (e) {
                        console.error("Save/Decode error", e);
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
                    speedWpm: plan.speedWpm,
                    useWebGPU: this.useWebGPU,
                    gpuPreference: this.gpuPreference
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

    async updateSettings(settings: Settings, onProgress?: (percent: number, message?: string) => void) {
        if (!this.currentPlan || !this.currentTokens.length) return;

        const wasPlaying = this.controller.getState() === 'PLAYING';
        const currentTokenIndex = this.controller.getCurrentTokenIndex();

        console.log(`Updating settings: WPM ${settings.speedWpm}, Voice ${settings.voiceId}`);

        // Check if we need full resynthesis
        // If only playbackRate changed, just set it on scheduler
        const sameVoice = this.currentPlan.voiceId === settings.voiceId;
        const sameSpeed = this.currentPlan.speedWpm === settings.speedWpm; // Base WPM
        const sameStrategy = this.currentPlan.strategy === settings.strategy;
        const sameChunkSize = this.currentPlan.chunkSize === settings.chunkSize;

        // Rate change is instant, doesn't affect plan
        if (settings.playbackRate !== undefined) {
            this.scheduler.setPlaybackRate(settings.playbackRate);
        }

        if (sameVoice && sameSpeed && sameStrategy && sameChunkSize) {
            // No synthesis needed
            return;
        }

        // Otherwise need partial or full replan
        console.log('[AudioEngine] Settings changed, triggering resynthesis...');
        // Reset playback rate to 1.0 since we are generating audio at the new target WPM
        this.scheduler.setPlaybackRate(1.0);

        // Re-load document with new settings
        // This triggers re-planning and re-synthesis (differential via cache)
        await this.loadDocument(this.currentPlan.docId, this.currentTokens, settings, 0, onProgress);

        // Restore playback state
        if (wasPlaying) {
            this.controller.play(currentTokenIndex).catch(console.error);
        } else {
            // Explicitly update cursor and UI without playing
            this.controller.seekByToken(currentTokenIndex);
        }
    }
}
