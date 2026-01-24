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
    private masterGain: GainNode;

    private playbackRate: number = 1.0;

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
    private lastOpId: number = 0;

    // Keep context active with silent buffer to hold Media Session focus
    private silenceNode: AudioBufferSourceNode | null = null;

    constructor() {
        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        this.ctx = new AudioContextClass();

        // Create Master Gain Node for volume control
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = 1.0; // Default volume

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
        this.ensureKeepAlive();
    }

    private ensureKeepAlive() {
        if (this.silenceNode) return;
        try {
            // Play infinite silence to keep the AudioContext active and the Media Session "claimed"
            // This prevents the OS from switching media focus to another app when we pause.
            const buffer = this.ctx.createBuffer(1, 1, 22050);
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            source.connect(this.ctx.destination);
            source.start();
            this.silenceNode = source;
        } catch (e) {
            console.warn("Failed to start keep-alive silence", e);
        }
    }

    setVolume(volume: number) {
        // Clamp 0-1
        const v = Math.max(0, Math.min(1, volume));
        this.masterGain.gain.value = v;
    }

    clear() {
        this.stopAll();
        this.playbackQueue = [];
    }

    setPlaybackRate(rate: number) {
        if (rate <= 0) return;
        this.playbackRate = rate;

        if (this.isPlaying) {
            const currentTime = this.getCurrentTime(); // Get current Timeline time
            this.play(currentTime); // Re-schedule everything
        }
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
        const absoluteStartTime = this.startTime + (item.startTimeSec / this.playbackRate);
        const itemEndSec = item.startTimeSec + item.buffer.duration; // Timeline end

        // Check if item ended before startOffset (Timeline check)
        if (itemEndSec <= startOffsetSec) {
            return;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = item.buffer;
        source.playbackRate.value = this.playbackRate;
        // Connect to Master Gain instead of destination
        source.connect(this.masterGain);

        // 2. If chunk starts in future (relative to now)
        if (absoluteStartTime >= now) {
            source.start(absoluteStartTime);
        }
        // 3. If chunk should have started in past (overlap with current playhead)
        else {
            const timePassedInAc = now - absoluteStartTime;
            const offsetInChunk = timePassedInAc * this.playbackRate;

            if (offsetInChunk < item.buffer.duration) {
                if (offsetInChunk < 0.08) {
                    source.start(now, 0);
                } else {
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

    async play(startOffsetSec: number = 0, opId?: number) {
        if (opId !== undefined) {
            if (opId < this.lastOpId) return; // Stale request
            this.lastOpId = opId;
        }

        await this.resumeContext();

        // Check again after await
        if (opId !== undefined && opId < this.lastOpId) return;

        this.stopAll();
        this.startTime = this.ctx.currentTime - (startOffsetSec / this.playbackRate);
        this.offsetTime = startOffsetSec;
        this.isPlaying = true;
        this.scheduleQueue(startOffsetSec);
    }

    private scheduleQueue(startOffsetSec: number) {
        for (const item of this.playbackQueue) {
            this.scheduleItem(item, startOffsetSec);
        }
    }

    async pause(opId?: number) {
        if (opId !== undefined) {
            if (opId < this.lastOpId) return;
            this.lastOpId = opId;
        }

        if (!this.isPlaying) return;
        this.offsetTime = this.getCurrentTime();

        // Do NOT suspend context here. Suspending causes the browser to release
        // the Media Session (media keys), causing the "Physical Play Button"
        // to resume other apps (e.g. Spotify) instead of this one.
        // await this.ctx.suspend(); 

        // Check again after wait
        if (opId !== undefined && opId < this.lastOpId) return;

        this.stopAll();
        this.isPlaying = false;
    }

    seek(time: number) {
        this.offsetTime = time;
    }

    stop() {
        this.stopAll();
        this.isPlaying = false;
        this.offsetTime = 0;
    }

    private stopAll() {
        this.sources.forEach(s => {
            try { s.stop(); } catch (e) { void e; }
            try { s.disconnect(); } catch (e) { void e; }
        });
        this.sources = [];
    }

    getCurrentTime(): number {
        if (!this.isPlaying) return this.offsetTime;

        const rawAcTime = this.ctx.currentTime - this.startTime;
        const timelineTime = rawAcTime * this.playbackRate;

        const latencyAc = (this.ctx.baseLatency || 0) + ((this.ctx as any).outputLatency || 0);
        const latencyTimeline = latencyAc * this.playbackRate;

        return Math.max(0, timelineTime - latencyTimeline);
    }

    getAudioContext(): AudioContext {
        return this.ctx;
    }
}
