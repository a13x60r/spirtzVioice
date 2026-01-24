import { audioStore } from '../storage/AudioStore';
import { voicePackageStore } from '../storage/VoicePackageStore';
import { VOICE_REGISTRY } from './VoiceRegistry';
import { AudioScheduler } from './AudioScheduler';
import { PlaybackController } from './PlaybackController';
import { PlanEngine } from '@domain/PlanEngine';
import { TimelineEngine } from '@domain/TimelineEngine';
import type { RenderPlan, Timeline, Token, Settings, VoicePackage } from '@spec/types';
import type { ChunkCompleteResponse, WorkerResponse, LoadVoiceRequest } from '@workers/tts-protocol';

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

    private isSynthesisCancelled: boolean = false;

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

    setVolume(volume: number) {
        this.scheduler.setVolume(volume);
    }

    cancelSynthesis() {
        this.isSynthesisCancelled = true;
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
        this.isSynthesisCancelled = false;

        // Prevent JIT buffering of stale chunks during synthesis
        this.currentTimeline = null;
        this.chunkTimeline = [];

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

        console.log('Synthesizing audio...');
        await this.synthesizeAllChunks(this.currentPlan, onProgress);

        if (this.isSynthesisCancelled) {
            console.log('Synthesis cancelled');
            onProgress?.(0, 'Cancelled');
            return;
        }

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
                // Fallback
                this.chunkTimeline.push({
                    chunkHash: chunk.chunkHash,
                    startSec: cumulativeTime,
                    endSec: cumulativeTime + duration
                });
            }
            cumulativeTime += duration;
        }

        this.chunkTimeline.sort((a, b) => a.startSec - b.startSec);
        this.controller.setTimeline(this.currentTimeline);

        // Initial buffering for start (or startTokenIndex time)
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

    // ... (bufferWindow, scheduleChunkFromStore, loadVoice unchanged) ...

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
        try {
            const arrayBuffer = await chunkEntity.data.arrayBuffer();
            const ctx = this.scheduler.getAudioContext();

            // Decode
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            this.scheduler.scheduleChunk(chunkHash, audioBuffer, startTime);
        } catch (e) {
            console.warn(`Failed to decode chunk ${chunkHash}`, e);
        }
    }

    async loadVoice(voiceId: string): Promise<void> {
        // Attempt to find in registry/store
        const installed = await voicePackageStore.isVoiceInstalled(voiceId);
        let assets: LoadVoiceRequest['assets'] | undefined;

        console.log(`[AudioEngine] loadVoice: ${voiceId}, installed=${installed}`);

        if (installed) {
            const model = await voicePackageStore.getVoiceAsset(voiceId, 'model.onnx');
            const config = await voicePackageStore.getVoiceAsset(voiceId, 'config.json');

            console.log(`[AudioEngine] Assets found: model=${!!model}, config=${!!config}`);

            if (model && config) {
                assets = { model, config };
            }
        }

        return new Promise((resolve, reject) => {
            this.pendingVoiceLoads.set(voiceId, { resolve, reject });
            this.worker.postMessage({
                type: 'LOAD_VOICE',
                payload: { voiceId, assets } as LoadVoiceRequest
            });
        });
    }

    async installVoice(voiceId: string, onProgress?: (percent: number) => void): Promise<void> {
        const voiceDef = VOICE_REGISTRY.find(v => v.id === voiceId);
        if (!voiceDef) throw new Error(`Voice ${voiceId} not found in registry`);

        if (await voicePackageStore.isVoiceInstalled(voiceId)) return;

        onProgress?.(10);
        const [modelRes, configRes] = await Promise.all([
            fetch(voiceDef.modelUrl),
            fetch(voiceDef.configUrl)
        ]);

        if (!modelRes.ok || !configRes.ok) throw new Error("Failed to download voice assets");

        const [modelData, configData] = await Promise.all([
            modelRes.arrayBuffer(),
            configRes.json()
        ]);

        onProgress?.(80);
        const metadata: VoicePackage = {
            voiceId: voiceDef.id,
            name: voiceDef.name,
            lang: voiceDef.lang,
            version: '1.0.0',
            sizeBytes: voiceDef.sizeBytes,
            assets: ['model.onnx', 'config.json']
        };

        const assetsMap = new Map<string, ArrayBuffer | Blob>();
        assetsMap.set('model.onnx', modelData);
        assetsMap.set('config.json', new Blob([JSON.stringify(configData)], { type: 'application/json' }));

        await voicePackageStore.installVoice(metadata, assetsMap);
        onProgress?.(100);
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
            if (this.isSynthesisCancelled) return; // Cancel check
            await this.synthesizeChunk(chunk, plan);
            completed++;
            onProgress?.(Math.round((completed / total) * 100), `Synthesizing chunk ${completed}/${total}...`);
        };

        // Process in batches
        for (let i = 0; i < total; i += CONCURRENCY) {
            if (this.isSynthesisCancelled) break; // Cancel check loop
            const batch = chunksToSynth.slice(i, i + CONCURRENCY);
            await Promise.all(batch.map((chunk) => processChunk(chunk)));
        }
    }

    private async synthesizeChunk(chunk: any, plan: RenderPlan): Promise<void> {
        if (this.isSynthesisCancelled) return; // Immediate bailout

        // Double check cache
        if (await audioStore.hasChunk(chunk.chunkHash)) return;

        return new Promise((resolve, reject) => {
            this.pendingChunks.set(chunk.chunkHash, {
                resolve: async (response) => {
                    if (this.isSynthesisCancelled) {
                        // Even if finished, if cancelled, maybe don't save? Or save anyway since work is done.
                        // Saving is fine.
                    }
                    try {
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

    async getAvailableVoices(): Promise<{ id: string, name: string, lang: string, isInstalled: boolean }[]> {
        const installed = await voicePackageStore.listVoices();
        const installedIds = new Set(installed.map(v => v.voiceId));

        return VOICE_REGISTRY.map(v => ({
            id: v.id,
            name: v.name,
            lang: v.lang,
            isInstalled: v.isBuiltIn || installedIds.has(v.id)
        }));
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
