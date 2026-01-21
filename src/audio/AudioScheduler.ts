/**
 * AudioScheduler: Manages Web Audio API scheduling
 * 
 * Responsibilities:
 * - Maintain AudioContext
 * - Schedule AudioBuffers (chunks)
 * - Handle play/pause/resume
 * - Manage precise timing
 */

export class AudioScheduler {
    private ctx: AudioContext;
    private sources: AudioBufferSourceNode[] = [];

    private playbackQueue: Array<{
        id: string;
        buffer: AudioBuffer;
        startTimeSec: number;
    }> = [];

    // Time tracking
    private startTime: number = 0; // AC time when playback started (0s on timeline)
    // private pauseTime: number = 0; // AC time when paused
    private offsetTime: number = 0; // How far into the timeline (buffer offset) we are

    private isPlaying: boolean = false;

    constructor() {
        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        this.ctx = new AudioContextClass();

        // Suspend by default until explicit play
        this.suspended();
    }

    private suspended() {
        if (this.ctx.state === 'running') {
            this.ctx.suspend();
        }
    }

    async resumeContext() {
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    }

    clear() {
        this.stopAll();
        this.playbackQueue = [];
    }

    /**
     * Queue a chunk to be played
     */
    scheduleChunk(
        chunkHash: string,
        audioBuffer: AudioBuffer,
        startTimeSec: number // Relative to timeline 0
    ) {
        // Check if already in queue to prevent duplicates
        if (this.playbackQueue.some(q => q.id === chunkHash)) {
            return;
        }

        const item = {
            id: chunkHash,
            buffer: audioBuffer,
            startTimeSec
        };
        this.playbackQueue.push(item);

        if (this.isPlaying) {
            this.scheduleItem(item, this.offsetTime);
        }
    }

    /**
     * Check if a chunk is currently in the playback queue
     */
    hasChunk(chunkHash: string): boolean {
        return this.playbackQueue.some(q => q.id === chunkHash);
    }

    private scheduleItem(item: { id: string, buffer: AudioBuffer, startTimeSec: number }, startOffsetSec: number) {
        const now = this.ctx.currentTime;
        const absoluteStartTime = this.startTime + item.startTimeSec;
        const itemEndSec = item.startTimeSec + item.buffer.duration;

        // 1. If chunk finished in the past relative to startOffset, skip
        // Note: we use strict past check, maybe keep 1s?
        if (itemEndSec <= startOffsetSec) {
            return;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = item.buffer;
        source.connect(this.ctx.destination);

        // 2. If chunk starts in future (relative to now)
        if (absoluteStartTime >= now) {
            source.start(absoluteStartTime);
        }
        // 3. If chunk should have started in past (overlap with current playhead)
        else {
            const offsetInChunk = now - absoluteStartTime;

            // Tolerance: If we are only slightly late (<80ms), play from start 
            // to avoid clipping the attack of the word (e.g. "The", "It").
            // This shifts the chunk slightly late, but prevents "missing words".
            const JITTER_TOLERANCE = 0.08;

            if (offsetInChunk < item.buffer.duration) {
                if (offsetInChunk < JITTER_TOLERANCE) {
                    // Play immediately from start
                    source.start(now, 0);
                } else {
                    // We are really late, seek into it
                    source.start(now, offsetInChunk);
                }
            }
        }

        this.sources.push(source);
        source.onended = () => {
            this.sources = this.sources.filter(s => s !== source);
        };
    }

    /**
     * Prune chunks that finished before time
     */
    pruneBefore(time: number) {
        this.playbackQueue = this.playbackQueue.filter(item => {
            const end = item.startTimeSec + item.buffer.duration;
            return end > time;
        });
    }

    async play(startOffsetSec: number = 0) {
        await this.resumeContext();

        // Stop any currently running sources
        this.stopAll();

        // Reset reference time
        // Timeline 0.0 aligns with (Now - startOffset)
        this.startTime = this.ctx.currentTime - startOffsetSec;
        this.offsetTime = startOffsetSec;
        this.isPlaying = true;

        this.scheduleQueue(startOffsetSec);
    }

    private scheduleQueue(startOffsetSec: number) {
        for (const item of this.playbackQueue) {
            this.scheduleItem(item, startOffsetSec);
        }
    }

    /**
     * Pause playback
     */
    async pause() {
        if (!this.isPlaying) return;

        // Capture where we are
        this.offsetTime = this.getCurrentTime();

        await this.ctx.suspend();
        this.stopAll();
        this.isPlaying = false;
    }

    /**
     * Stop completely
     */
    stop() {
        this.stopAll();
        this.isPlaying = false;
        this.offsetTime = 0;
    }

    private stopAll() {
        this.sources.forEach(s => {
            try { s.stop(); } catch (e) { }
            try { s.disconnect(); } catch (e) { }
        });
        this.sources = [];
    }

    /**
     * Get current playback time in seconds (relative to timeline 0)
     */
    getCurrentTime(): number {
        if (!this.isPlaying) return this.offsetTime;

        // AC time could be advancing even if we suspended, so use context time carefully
        // If context is running:
        const rawTime = this.ctx.currentTime - this.startTime;

        // Compensate for audio output latency
        // AudioContext.baseLatency gives us the processing latency,
        // AudioContext.outputLatency gives us the output device latency (if available)
        const latency = (this.ctx.baseLatency || 0) + ((this.ctx as any).outputLatency || 0);

        // Subtract latency so cursor stays behind the actual audio output
        return Math.max(0, rawTime - latency);
    }

    getAudioContext(): AudioContext {
        return this.ctx;
    }
}
