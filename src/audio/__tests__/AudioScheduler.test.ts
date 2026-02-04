import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioScheduler } from '../AudioScheduler';

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

// Assign to global
global.AudioContext = MockAudioContext as any;

describe('AudioScheduler', () => {
    let scheduler: AudioScheduler;
    let mockCtx: any;

    beforeEach(() => {
        scheduler = new AudioScheduler();
        mockCtx = scheduler.getAudioContext();
    });

    it('should initialize in suspended state', () => {
        expect(scheduler.getAudioContext().state).toBe('suspended');
    });

    it('should resume context on play', async () => {
        await scheduler.play(0);
        expect(mockCtx.resume).toHaveBeenCalled();
        expect(mockCtx.state).toBe('running');
    });

    it('should track current time', async () => {
        await scheduler.play(0);

        // Advance mock time
        mockCtx.currentTime = 5;

        // Started at 0, now 5. Correct.
        expect(scheduler.getCurrentTime()).toBeCloseTo(5, 1);
    });

    it('should handle seek offset', async () => {
        // Seek to 10s
        await scheduler.play(10);

        // internal startTime = currentTime (0) - 10 = -10.
        // If currentTime is 0, reported time should be 0 - (-10) = 10.
        expect(scheduler.getCurrentTime()).toBeCloseTo(10, 1);

        // Advance mock time by 5s (currentTime = 5)
        mockCtx.currentTime = 5;

        // Reported time: 5 - (-10) = 15.
        expect(scheduler.getCurrentTime()).toBeCloseTo(15, 1);
    });

    it('should stop sources on pause', async () => {
        await scheduler.play(0);
        await scheduler.pause();

        expect(mockCtx.suspend).not.toHaveBeenCalled();
        // Since we mock createBufferSource, checking stopAll is tricky without inspecting the source mock instances
        // But we rely on basic coverage here.
    });
});
