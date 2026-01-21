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

    setPlaybackRate(rate: number) {
        if (rate <= 0) return;
        this.playbackRate = rate;

        // If currently playing, we should ideally seamlessly transition
        // But for MVP, we might need to flush/seek to ensure timing consistency
        // Simpler: Just update active sources. BUT that desyncs the scheduler's future plan
        // because scheduled start times were calculated with old Rate?
        // Actually, scheduleItem calc happens at schedule time.
        // Wait, current logic calls scheduleItem repeatedly or one-shot? 
        // scheduleQueue calls scheduleItem for ALL items. 
        // AudioBufferSourceNode.start(T) sets the start time. We can't change T after start().
        // So we MUST stop and restart everything to change rate correctly.

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

        // Calculate effective start time and duration based on rate
        // Start Time in AC = BaseStart + (TimelinePos / Rate)
        // Wait, this.startTime is AC time when Timeline=0
        // So AbsoluteStart = this.startTime + (item.startTimeSec / this.playbackRate)

        const absoluteStartTime = this.startTime + (item.startTimeSec / this.playbackRate);
        const itemEndSec = item.startTimeSec + item.buffer.duration; // Timeline end

        // Check if item ended before startOffset (Timeline check)
        if (itemEndSec <= startOffsetSec) {
            return;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = item.buffer;
        source.playbackRate.value = this.playbackRate;
        source.connect(this.ctx.destination);

        // 2. If chunk starts in future (relative to now)
        if (absoluteStartTime >= now) {
            source.start(absoluteStartTime);
        }
        // 3. If chunk should have started in past (overlap with current playhead)
        else {
            // How much time has passed in AC domain?
            const timePassedInAc = now - absoluteStartTime;

            // Convert to Buffer domain
            // offsetInChunk = timePassedInAc * Rate
            const offsetInChunk = timePassedInAc * this.playbackRate;

            // Tolerance: If we are only slightly late (<80ms), play from start 
            // to avoid clipping the attack of the word (e.g. "The", "It").
            // This shifts the chunk slightly late, but prevents "missing words".

            if (offsetInChunk < item.buffer.duration) {
                if (offsetInChunk < 0.08) { // Keep fixed tolerance for internal jitter
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
        // We want Timeline=startOffsetSec to equal AC=now
        // Timeline=0 is at AC = now - (startOffsetSec / Rate)
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

        // If context is running:
        // elapsedAc = now - startTime
        // elapsedTimeline = elapsedAc * Rate

        const rawAcTime = this.ctx.currentTime - this.startTime;
        const timelineTime = rawAcTime * this.playbackRate;

        // Compensate for audio output latency
        // Latency is time in AC domain.
        // We want to subtract equivalent Timeline time.
        const latencyAc = (this.ctx.baseLatency || 0) + ((this.ctx as any).outputLatency || 0);
        const latencyTimeline = latencyAc * this.playbackRate;

        // Subtract latency so cursor stays behind the actual audio output
        return Math.max(0, timelineTime - latencyTimeline);
    }

    getAudioContext(): AudioContext {
        return this.ctx;
    }
}
