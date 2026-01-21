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
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
        onended: null
    });
    destination = {};
}

global.AudioContext = MockAudioContext as any;

describe('PlaybackController', () => {
    let controller: PlaybackController;

    beforeEach(() => {
        controller = new PlaybackController();
    });

    it('should return 0 duration when no timeline is set', () => {
        // @ts-ignore - method might not exist yet
        expect(controller.getDuration?.() ?? 0).toBe(0);
    });

    it('should return correct duration when timeline is set', () => {
        const timeline: Timeline = {
            planId: 'test-plan',
            entries: [],
            durationSec: 123.45
        };

        controller.setTimeline(timeline);

        // @ts-ignore
        expect(controller.getDuration?.()).toBe(123.45);
    });
});
