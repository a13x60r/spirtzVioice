import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlaybackController } from '../PlaybackController';
import { Timeline } from '@spec/types';

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

describe('PlaybackController', () => {
    let controller: PlaybackController;

    beforeEach(() => {
        controller = new PlaybackController();
    });

    it('should return 0 duration when no timeline is set', () => {
        const duration = (controller as { getDuration?: () => number }).getDuration?.() ?? 0;
        expect(duration).toBe(0);
    });

    it('should return correct duration when timeline is set', () => {
        const timeline: Timeline = {
            planId: 'test-plan',
            entries: [],
            durationSec: 123.45
        };

        controller.setTimeline(timeline);

        const duration = (controller as { getDuration?: () => number }).getDuration?.();
        expect(duration).toBe(123.45);
    });
});
