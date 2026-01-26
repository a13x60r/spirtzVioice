import { audioStore } from '../storage/AudioStore';
import { voicePackageStore } from '../storage/VoicePackageStore';
import { VOICE_REGISTRY } from './VoiceRegistry';
import { AudioScheduler } from './AudioScheduler';
import { PlaybackController } from './PlaybackController';
import { PlanEngine } from '@domain/PlanEngine';
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
    private pendingChunks = new Map<string, { resolve: (response: ChunkCompleteResponse) => void, reject: (err: any) => void, sessionId: number }>();
    // Pending resolver map for voice loads
    private pendingVoiceLoads = new Map<string, { resolve: () => void, reject: (err: Error) => void }>();

    // Track currently buffered chunks to prevent duplicates
    private bufferedChunks = new Set<string>();
    private loadedVoiceId: string | null = null;
    private loadedVoiceHasAssets: boolean = false;
    private pendingVoiceAssets = new Map<string, boolean>();

    // Optimized timeline for chunks { hash, start, end }
    private chunkTimeline: { chunkHash: string, startSec: number, endSec: number }[] = [];
    private pendingDurations = new Map<string, number>();
    private nextChunkIndex: number = 0;
    private chunkCumulativeTime: number = 0;
    private timelineComplete: boolean = true;
    private synthesisSessionId: number = 0;
    private currentChunkHashSet = new Set<string>();
    private currentChunkByHash = new Map<string, any>();

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

    destroy() {
        this.cancelSynthesis();
        this.pendingChunks.clear();
        this.pendingVoiceLoads.clear();
        this.pendingVoiceAssets.clear();
        this.scheduler.clear();
        this.worker.terminate();
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
        this.pendingDurations.clear();
        this.nextChunkIndex = 0;
        this.chunkCumulativeTime = 0;
        this.timelineComplete = false;
        this.controller.setTimelineComplete(false);
        this.synthesisSessionId++;
        const sessionId = this.synthesisSessionId;

        // Prevent JIT buffering of stale chunks during synthesis
        this.currentTimeline = null;
        this.chunkTimeline = [];
        this.currentChunkHashSet.clear();
        this.currentChunkByHash.clear();

        // Clear previous schedule
        this.scheduler.clear();

        // Ensure voice is loaded
        console.log(`Loading voice ${settings.voiceId}...`);
        await this.loadVoice(settings.voiceId);

        console.log('Generating plan...');
        // Create Plan
        const plan = await PlanEngine.generatePlan(docId, tokens, settings);
        this.currentPlan = plan;
        this.currentChunkHashSet = new Set(plan.chunks.map(c => c.chunkHash));
        this.currentChunkByHash = new Map(plan.chunks.map(c => [c.chunkHash, c]));

        // Apply playback rate
        if (settings.playbackRate) {
            this.scheduler.setPlaybackRate(settings.playbackRate);
        }

        console.log('Synthesizing initial audio...');
        const initialChunkTarget = this.getInitialChunkTargetIndex(plan, _startTokenIndex);
        const DEFAULT_INITIAL_CHUNKS = 2;
        const initialChunkCount = Math.min(
            plan.chunks.length,
            Math.max(DEFAULT_INITIAL_CHUNKS, initialChunkTarget + 1)
        );
        await this.synthesizeInitialChunks(plan, initialChunkCount, onProgress, sessionId);

        await this.appendAvailableTimeline(sessionId);

        // Continue synthesis in background
        void this.synthesizeRemainingChunks(plan, initialChunkCount, onProgress, sessionId);

        if (this.isSynthesisCancelled) {
            console.log('Synthesis cancelled');
            onProgress?.(0, 'Cancelled');
            return;
        }

        if (!this.currentPlan) return;

        // Initial buffering for start (or startTokenIndex time)
        let startTime = 0;
        if (_startTokenIndex > 0) {
            const entry = (this.currentTimeline as any)?.entries?.find((entry: any) => entry.tokenIndex === _startTokenIndex);
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
            const chunk = this.currentChunkByHash.get(chunkHash);
            if (chunk && this.currentPlan) {
                this.synthesizeChunk(chunk, this.currentPlan, this.synthesisSessionId).catch(console.warn);
            }
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

        if (this.loadedVoiceId === voiceId && this.loadedVoiceHasAssets === !!assets && !this.pendingVoiceLoads.has(voiceId)) {
            return;
        }

        if (this.pendingVoiceLoads.has(voiceId)) {
            return new Promise((resolve, reject) => {
                const existing = this.pendingVoiceLoads.get(voiceId);
                if (!existing) {
                    resolve();
                    return;
                }
                this.pendingVoiceLoads.set(voiceId, {
                    resolve: () => {
                        existing.resolve();
                        resolve();
                    },
                    reject: (err: Error) => {
                        existing.reject(err);
                        reject(err);
                    }
                });
            });
        }

        this.pendingVoiceAssets.set(voiceId, !!assets);

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

    private getInitialChunkTargetIndex(plan: RenderPlan, startTokenIndex: number): number {
        if (startTokenIndex <= 0) return 0;
        const idx = plan.chunks.findIndex(c => startTokenIndex >= c.startTokenIndex && startTokenIndex < c.endTokenIndex);
        return idx >= 0 ? idx : 0;
    }

    private async synthesizeInitialChunks(
        plan: RenderPlan,
        initialChunkCount: number,
        onProgress: ((percent: number, message?: string) => void) | undefined,
        sessionId: number
    ) {
        const target = Math.min(initialChunkCount, plan.chunks.length);
        if (target === 0) return;

        onProgress?.(0, `Preparing audio 0/${target}...`);

        for (let i = 0; i < target; i++) {
            if (this.isSynthesisCancelled || sessionId !== this.synthesisSessionId) return;
            const chunk = plan.chunks[i];
            const duration = await this.getChunkDuration(chunk.chunkHash);
            if (duration !== undefined) {
                this.pendingDurations.set(chunk.chunkHash, duration);
                onProgress?.(Math.round(((i + 1) / target) * 100), `Preparing audio ${i + 1}/${target}...`);
                continue;
            }
            await this.synthesizeChunk(chunk, plan, sessionId);
            onProgress?.(Math.round(((i + 1) / target) * 100), `Preparing audio ${i + 1}/${target}...`);
        }
    }

    private async synthesizeRemainingChunks(
        plan: RenderPlan,
        startIndex: number,
        onProgress: ((percent: number, message?: string) => void) | undefined,
        sessionId: number
    ) {
        if (sessionId !== this.synthesisSessionId) return;

        const chunksToSynth: any[] = [];

        for (let i = startIndex; i < plan.chunks.length; i++) {
            const chunk = plan.chunks[i];
            if (await audioStore.hasChunk(chunk.chunkHash)) {
                continue;
            }
            chunksToSynth.push(chunk);
        }

        const total = chunksToSynth.length;
        if (total === 0) {
            await this.appendAvailableTimeline(sessionId);
            return;
        }

        onProgress?.(0, `Synthesizing 0/${total} chunks...`);

        const CONCURRENCY = 3;
        let completed = 0;

        const processChunk = async (chunk: any) => {
            if (this.isSynthesisCancelled || sessionId !== this.synthesisSessionId) return;
            await this.synthesizeChunk(chunk, plan, sessionId);
            completed++;
            onProgress?.(Math.round((completed / total) * 100), `Synthesizing chunk ${completed}/${total}...`);
        };

        for (let i = 0; i < total; i += CONCURRENCY) {
            if (this.isSynthesisCancelled || sessionId !== this.synthesisSessionId) break;
            const batch = chunksToSynth.slice(i, i + CONCURRENCY);
            await Promise.all(batch.map((chunk) => processChunk(chunk)));
        }

        await this.appendAvailableTimeline(sessionId);
    }

    private async getChunkDuration(chunkHash: string): Promise<number | undefined> {
        const cached = this.pendingDurations.get(chunkHash);
        if (cached !== undefined) return cached;

        const dur = await audioStore.getDuration(chunkHash);
        if (dur !== undefined) this.pendingDurations.set(chunkHash, dur);
        return dur;
    }

    private async appendAvailableTimeline(sessionId: number) {
        if (sessionId !== this.synthesisSessionId) return;
        if (!this.currentPlan) return;

        if (!this.currentTimeline) {
            this.currentTimeline = {
                planId: this.currentPlan.planId,
                entries: [],
                durationSec: 0
            };
        }

        let currentTime = this.currentTimeline.durationSec;

        while (this.nextChunkIndex < this.currentPlan.chunks.length) {
            const chunk = this.currentPlan.chunks[this.nextChunkIndex];
            const duration = await this.getChunkDuration(chunk.chunkHash);
            if (duration === undefined) break;

            const chunkStartSec = this.chunkCumulativeTime;
            const chunkEndSec = chunkStartSec + duration;

            const chunkTokens = this.currentTokens.slice(chunk.startTokenIndex, chunk.endTokenIndex);

            if (this.currentPlan.strategy === 'TOKEN') {
                const token = chunkTokens[0];
                if (token) {
                    this.currentTimeline.entries.push({
                        tokenId: token.tokenId,
                        tokenIndex: token.index,
                        tStartSec: currentTime,
                        tEndSec: currentTime + duration
                    });
                    currentTime += duration;
                }
            } else {
                const validTokens = chunkTokens.filter(t => t.type === 'word');
                const totalWeight = validTokens.length;

                if (totalWeight > 0) {
                    const timePerToken = duration / totalWeight;

                    for (const token of chunkTokens) {
                        if (token.type === 'word') {
                            this.currentTimeline.entries.push({
                                tokenId: token.tokenId,
                                tokenIndex: token.index,
                                tStartSec: currentTime,
                                tEndSec: currentTime + timePerToken
                            });
                            currentTime += timePerToken;
                        }
                    }
                }
            }

            this.chunkTimeline.push({
                chunkHash: chunk.chunkHash,
                startSec: chunkStartSec,
                endSec: chunkEndSec
            });

            this.chunkCumulativeTime = chunkEndSec;
            this.nextChunkIndex++;
        }

        this.currentTimeline.durationSec = currentTime;
        this.controller.setTimeline(this.currentTimeline);

        const complete = this.nextChunkIndex >= this.currentPlan.chunks.length;
        if (complete !== this.timelineComplete) {
            this.timelineComplete = complete;
            this.controller.setTimelineComplete(complete);
        }
    }

    private async synthesizeChunk(chunk: any, plan: RenderPlan, sessionId: number): Promise<void> {
        if (this.isSynthesisCancelled) return; // Immediate bailout

        if (this.pendingChunks.has(chunk.chunkHash)) return;

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
                        if (sessionId === this.synthesisSessionId && this.currentChunkHashSet.has(chunk.chunkHash)) {
                            this.pendingDurations.set(chunk.chunkHash, duration);
                            await this.appendAvailableTimeline(sessionId);
                        }
                        resolve();
                    } catch (e) {
                        console.error("Save/Decode error", e);
                        reject(e);
                    }
                },
                reject: (err) => {
                    console.error("Chunk synthesis rejected", err);
                    reject(err);
                },
                sessionId
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
                this.loadedVoiceId = payload.voiceId;
                this.loadedVoiceHasAssets = this.pendingVoiceAssets.get(payload.voiceId) || false;
                this.pendingVoiceAssets.delete(payload.voiceId);
                break;
            }
            case 'VOICE_ERROR': {
                if (payload && payload.voiceId) {
                    const resolver = this.pendingVoiceLoads.get(payload.voiceId);
                    if (resolver) {
                        resolver.reject(new Error(error));
                        this.pendingVoiceLoads.delete(payload.voiceId);
                    }
                    this.pendingVoiceAssets.delete(payload.voiceId);
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
        await this.loadDocument(this.currentPlan.docId, this.currentTokens, settings, currentTokenIndex, onProgress);

        // Restore playback state
        if (wasPlaying) {
            this.controller.play(currentTokenIndex).catch(console.error);
        } else {
            // Explicitly update cursor and UI without playing
            this.controller.seekByToken(currentTokenIndex);
        }
    }
}
