import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlaybackController } from '../PlaybackController';
import { Timeline, Token } from '@spec/types';

// Mock Web Audio API
class MockAudioContext {
    state = 'suspended';
    currentTime = 0;
    suspend = vi.fn().mockResolvedValue(undefined);
    resume = vi.fn().mockImplementation(async () => {
        this.state = 'running';
    });
    createBufferSource = vi.fn().mockReturnValue({
        buffer: null,
        playbackRate: { value: 1 },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
        onended: null
    });
    createGain = vi.fn().mockReturnValue({
        connect: vi.fn(),
        gain: { value: 1 }
    });
    createBuffer = vi.fn().mockReturnValue({});
    destination = {};
}

global.AudioContext = MockAudioContext as any;

describe('PlaybackController (TTS Sync)', () => {
    let controller: PlaybackController;
    let mockTimeline: Timeline;

    beforeEach(() => {
        vi.useFakeTimers();
        controller = new PlaybackController();
        
        mockTimeline = {
            planId: 'test-plan',
            durationSec: 3.5,
            entries: [
                { tokenIndex: 0, tokenId: 't0', tStartSec: 0.0, tEndSec: 1.0 },
                { tokenIndex: 1, tokenId: 't1', tStartSec: 1.0, tEndSec: 2.0 },
                { tokenIndex: 2, tokenId: 't2', tStartSec: 2.0, tEndSec: 3.0 },
                { tokenIndex: 3, tokenId: 't3', tStartSec: 3.0, tEndSec: 3.5 }
            ]
        };
    });

    afterEach(() => {
        controller.pause(); // Cleanup intervals
        vi.useRealTimers();
    });

    it('should return 0 duration when no timeline is set', () => {
        const duration = controller.getDuration();
        expect(duration).toBe(0);
    });

    it('should return correct duration when timeline is set', () => {
        controller.setTimeline(mockTimeline);
        expect(controller.getDuration()).toBe(3.5);
    });

    it('should fire onTokenChanged synchronized with audio scheduler time', async () => {
        controller.setTimeline(mockTimeline);
        
        const tokenChangeSpy = vi.fn();
        controller.onTokenChanged = tokenChangeSpy;

        // Start playback
        await controller.play(0);

        // At 0s, token 0 should be active
        vi.advanceTimersByTime(100); // Trigger a tick event
        expect(tokenChangeSpy).toHaveBeenCalledWith(0);

        // Advance audio context and timers to 1.5s -> inside token 1
        const scheduler = controller.getScheduler();
        const mockCtx = scheduler.getAudioContext() as any;
        mockCtx.currentTime = 1.5;
        
        vi.advanceTimersByTime(16); // Trigger next tick
        expect(tokenChangeSpy).toHaveBeenCalledWith(1);

        // Advance time to 2.5s -> inside token 2
        mockCtx.currentTime = 2.5;
        vi.advanceTimersByTime(16);
        expect(tokenChangeSpy).toHaveBeenCalledWith(2);
    });
    
    it('should seek to correct token when seeking by time', async () => {
        controller.setTimeline(mockTimeline);
        const tokenChangeSpy = vi.fn();
        controller.onTokenChanged = tokenChangeSpy;

        // Seek to 3.2s -> token 3
        controller.seek(3.2);

        // Note: seek updates cursor directly if paused
        expect(tokenChangeSpy).toHaveBeenCalledWith(3);
    });
    
    it('should correctly jump time when seeking by token index', async () => {
        controller.setTimeline(mockTimeline);
        const timeUpdateSpy = vi.fn();
        controller.onTimeUpdate = timeUpdateSpy;

        // Seek to token 2, which starts at 2.0s
        controller.seekByToken(2);
        
        expect(timeUpdateSpy).toHaveBeenCalledWith(2.0);
    });
    
    it('should correctly skip sentence and trigger token sync', async () => {
        controller.setTimeline(mockTimeline);
        const tokenChangeSpy = vi.fn();
        controller.onTokenChanged = tokenChangeSpy;

        // Mock simple tokens
        const tokens: Token[] = [
            { index: 0, tokenId: 't0', text: 'Word', normText: 'word', type: 'word', sentenceId: 0, startOffset: 0, endOffset: 4 },
            { index: 1, tokenId: 't1', text: 'Word', normText: 'word', type: 'word', sentenceId: 0, startOffset: 5, endOffset: 9 },
            { index: 2, tokenId: 't2', text: 'Sentence2', normText: 'sentence2', type: 'word', sentenceId: 1, startOffset: 10, endOffset: 19 },
            { index: 3, tokenId: 't3', text: 'Word', normText: 'word', type: 'word', sentenceId: 1, startOffset: 20, endOffset: 24 }
        ];

        // Currently at token 0 (Sentence 0)
        controller.seekByToken(0);
        
        // Skip forward 1 sentence
        controller.skipSentence(1, tokens);
        
        // Should jump to token index 2 (first token of sentence 1)
        expect(tokenChangeSpy).toHaveBeenCalledWith(2);
    });
});
