import { AudioScheduler } from './AudioScheduler';
import { PlaybackCursor } from './PlaybackCursor';
import { TimelineEngine } from '@domain/TimelineEngine';
import type { Timeline } from '@spec/types';

export class PlaybackController {
    private scheduler: AudioScheduler;
    private cursor: PlaybackCursor;
    private timeline: Timeline | null = null;

    // Callbacks for UI updates
    onTimeUpdate?: (time: number) => void;
    onTokenChanged?: (tokenIndex: number) => void;
    onStateChanged?: (isPlaying: boolean) => void;

    private updateInterval: number | null = null;
    private lastTokenIndex: number = -1;
    private isPlaying: boolean = false;

    constructor() {
        this.scheduler = new AudioScheduler();
        this.cursor = new PlaybackCursor();
    }

    setTimeline(timeline: Timeline) {
        this.timeline = timeline;
        this.cursor.setTimeline(timeline);
    }

    async play(startFromTokenIndex: number = -1) {
        if (!this.timeline) {
            console.warn("No timeline set");
            return;
        }

        let startOffset = this.scheduler.getCurrentTime();

        if (startFromTokenIndex >= 0) {
            startOffset = TimelineEngine.getTimeForToken(this.timeline, startFromTokenIndex);
        }

        // If we reached the end, restart
        if (startOffset >= this.timeline.durationSec) {
            startOffset = 0;
        }

        await this.scheduler.play(startOffset);
        this.startLoop();
        this.setIsPlaying(true);
    }

    async pause() {
        await this.scheduler.pause();
        this.stopLoop();
        this.setIsPlaying(false);
    }

    getState(): 'PLAYING' | 'PAUSED' | 'IDLE' {
        if (this.isPlaying) return 'PLAYING';
        if (this.timeline) return 'PAUSED';
        return 'IDLE';
    }

    seek(offsetSec: number) {
        if (!this.timeline) return;
        const current = this.scheduler.getCurrentTime();
        let target = current + offsetSec;
        target = Math.max(0, Math.min(target, this.timeline.durationSec));

        const wasPlaying = this.isPlaying;
        if (wasPlaying) {
            // Stop, seek, play
            this.scheduler.play(target).catch(console.error);
        } else {
            // Just update UI? 
            // We can't really "seek" the scheduler without playing usually, unless we track a manual offset.
            // For MVP: Just start playing from there? Or implement updateTime manually.
        }
        // Minimal implementation
    }

    seekByToken(tokenIndex: number) {
        if (!this.timeline) return;

        const time = TimelineEngine.getTimeForToken(this.timeline, tokenIndex);
        const wasPlaying = this.isPlaying;

        if (wasPlaying) {
            this.play(tokenIndex); // Replay from new position
        } else {
            this.lastTokenIndex = tokenIndex;
            this.onTokenChanged?.(tokenIndex);
            this.onTimeUpdate?.(time);
        }
    }

    getScheduler() {
        return this.scheduler;
    }

    private startLoop() {
        this.stopLoop();
        this.updateInterval = window.setInterval(() => {
            this.tick();
        }, 16); // ~60fps
    }

    private stopLoop() {
        if (this.updateInterval) {
            window.clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    private setIsPlaying(playing: boolean) {
        if (this.isPlaying !== playing) {
            this.isPlaying = playing;
            this.onStateChanged?.(playing);
        }
    }

    private tick() {
        const time = this.scheduler.getCurrentTime();
        this.onTimeUpdate?.(time);

        const tokenIndex = this.cursor.getCurrentTokenIndex(time);
        if (tokenIndex !== this.lastTokenIndex) {
            this.lastTokenIndex = tokenIndex;
            this.onTokenChanged?.(tokenIndex);
        }

        // Check for end
        if (this.timeline && time >= this.timeline.durationSec) {
            this.pause();
        }
    }
}
