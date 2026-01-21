import type { Timeline, TimelineEntry } from '@spec/types';
import { TimelineEngine } from '@domain/TimelineEngine';

/**
 * PlaybackCursor: Derives current token from AudioContext time
 * 
 * Responsibilities:
 * - Map audio time to token index
 * - Handle boundary conditions
 */
export class PlaybackCursor {
    private currentTimeline: Timeline | null = null;
    // private audioStartTime: number = 0; // When playback started in AC time
    // private pausedTime: number = 0; // Accumulated paused time (if resumed)

    // Track playback state relative to AC
    // offset = (AC.currentTime - startTime) + seekOffset

    constructor() { }

    /**
     * Set the active timeline
     */
    setTimeline(timeline: Timeline) {
        this.currentTimeline = timeline;
    }

    /**
     * Get current token index based on current playback time
     * @param currentAudioTime The current playback time in seconds (relative to timeline start 0)
     */
    getCurrentTokenIndex(currentAudioTime: number): number {
        if (!this.currentTimeline) return -1;
        return TimelineEngine.getCurrentTokenIndex(this.currentTimeline, currentAudioTime);
    }

    /**
     * Get time range for a token
     */
    getTokenTiming(tokenIndex: number): TimelineEntry | undefined {
        if (!this.currentTimeline) return undefined;
        return this.currentTimeline.entries.find(e => e.tokenIndex === tokenIndex);
    }

    /**
     * Get total duration of current timeline
     */
    getDuration(): number {
        return this.currentTimeline?.durationSec ?? 0;
    }
}
