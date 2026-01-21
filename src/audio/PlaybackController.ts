import { AudioScheduler } from './AudioScheduler';
import { PlaybackCursor } from './PlaybackCursor';
import { TimelineEngine } from '@domain/TimelineEngine';
import type { Timeline, Token } from '@spec/types';

export class PlaybackController {
    private scheduler: AudioScheduler;
    private cursor: PlaybackCursor;
    private timeline: Timeline | null = null;

    // Callbacks for UI updates
    onTimeUpdate?: (time: number) => void;
    onTokenChanged?: (tokenIndex: number) => void;
    onStateChanged?: (isPlaying: boolean) => void;
    onBufferingRequest?: (time: number) => void;

    private updateInterval: number | null = null;
    private lastTokenIndex: number = -1;
    private isPlaying: boolean = false;
    private lastBufferingTime: number = -1;

    constructor() {
        this.scheduler = new AudioScheduler();
        this.cursor = new PlaybackCursor();
    }

    setTimeline(timeline: Timeline) {
        this.timeline = timeline;
        this.cursor.setTimeline(timeline);
    }

    getDuration(): number {
        return this.timeline?.durationSec ?? 0;
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

        // Initial buffer check
        this.onBufferingRequest?.(startOffset);
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
            this.onBufferingRequest?.(target);
        } else {
            this.scheduler.seek(target);
            this.onTimeUpdate?.(target);
            const tokenIndex = this.cursor.getCurrentTokenIndex(target);
            if (tokenIndex !== this.lastTokenIndex) {
                this.lastTokenIndex = tokenIndex;
                this.onTokenChanged?.(tokenIndex);
            }
            this.onBufferingRequest?.(target);
        }
    }

    seekByToken(tokenIndex: number) {
        if (!this.timeline) return;

        const time = TimelineEngine.getTimeForToken(this.timeline, tokenIndex);
        const wasPlaying = this.isPlaying;

        if (wasPlaying) {
            this.play(tokenIndex); // Replay from new position
        } else {
            this.scheduler.seek(time);
            this.lastTokenIndex = tokenIndex;
            this.onTokenChanged?.(tokenIndex);
            this.onTimeUpdate?.(time);
            this.onBufferingRequest?.(time);
        }
    }

    skipWord(direction: 1 | -1, tokens: Token[]) {
        if (!this.timeline) return;
        const currentIndex = this.getCurrentTokenIndex();

        // Find next/prev word token
        let targetIndex = currentIndex + direction;
        while (targetIndex >= 0 && targetIndex < tokens.length) {
            if (tokens[targetIndex].type === 'word') {
                break;
            }
            targetIndex += direction;
        }

        if (targetIndex >= 0 && targetIndex < tokens.length) {
            this.seekByToken(targetIndex);
        }
    }

    skipSentence(direction: 1 | -1, tokens: Token[]) {
        if (!this.timeline) return;
        const currentIndex = this.getCurrentTokenIndex();
        const currentToken = tokens[currentIndex];
        if (!currentToken) return;

        const currentSentenceId = currentToken.sentenceId;
        let targetSentenceId = currentSentenceId + direction;

        // Find the first token of the target sentence
        const targetToken = tokens.find(t => t.sentenceId === targetSentenceId);
        if (targetToken) {
            this.seekByToken(targetToken.index);
        }
    }

    skipParagraph(direction: 1 | -1, tokens: Token[]) {
        if (!this.timeline) return;
        const currentIndex = this.getCurrentTokenIndex();

        // A paragraph break is usually a newline token with length > 1 (or multiple newlines)
        let targetIndex = currentIndex + direction;
        let foundNewline = false;

        while (targetIndex >= 0 && targetIndex < tokens.length) {
            const token = tokens[targetIndex];
            if (token.type === 'newline') {
                foundNewline = true;
            } else if (foundNewline && token.type === 'word') {
                // Found a word after a newline, this is the start of a paragraph
                break;
            }
            targetIndex += direction;
        }

        if (targetIndex >= 0 && targetIndex < tokens.length) {
            this.seekByToken(targetIndex);
        } else if (direction === -1) {
            this.seekByToken(0); // Go to start if skipping back from first para
        }
    }

    getScheduler() {
        return this.scheduler;
    }

    getCurrentTokenIndex(): number {
        const time = this.scheduler.getCurrentTime();
        return this.cursor.getCurrentTokenIndex(time);
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

        // Buffer check every 1s
        if (Math.abs(time - this.lastBufferingTime) > 1.0) {
            this.lastBufferingTime = time;
            this.onBufferingRequest?.(time);
        }

        // Check for end
        if (this.timeline && time >= this.timeline.durationSec) {
            this.pause();
        }
    }
}
