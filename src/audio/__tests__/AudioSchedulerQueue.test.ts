import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioScheduler } from '../AudioScheduler';

// Mock Web Audio API
class MockAudioBufferSource {
    buffer: any = null;
    playbackRate = { value: 1 };
    start = vi.fn();
    stop = vi.fn();
    disconnect = vi.fn();
    connect = vi.fn();
    onended: any = null;
}

class MockAudioContext {
    state = 'suspended';
    currentTime = 0;
    suspend = vi.fn().mockResolvedValue(undefined);
    resume = vi.fn().mockImplementation(async () => {
        this.state = 'running';
    });
    createBufferSource = vi.fn().mockImplementation(() => new MockAudioBufferSource());
    createGain = vi.fn().mockReturnValue({
        connect: vi.fn(),
        gain: { value: 1 }
    });
    createBuffer = vi.fn().mockReturnValue({});
    destination = {};
}

global.AudioContext = MockAudioContext as any;

describe('AudioScheduler Queue', () => {
    let scheduler: AudioScheduler;
    let mockCtx: any;

    beforeEach(() => {
        vi.clearAllMocks();
        scheduler = new AudioScheduler();
        mockCtx = scheduler.getAudioContext();
    });

    it('should queue chunks and play them on play()', async () => {
        const mockBuffer = { duration: 5 } as AudioBuffer;

        // Schedule before playing
        scheduler.scheduleChunk('id1', mockBuffer, 0); // Starts at 0
        scheduler.scheduleChunk('id2', mockBuffer, 5); // Starts at 5

        expect(mockCtx.createBufferSource).not.toHaveBeenCalled();

        await scheduler.play(0);

        expect(mockCtx.createBufferSource).toHaveBeenCalledTimes(3);
    });

    it('should skip past chunks', async () => {
        const mockBuffer = { duration: 5 } as AudioBuffer;

        // Chunk 1: 0-5s
        scheduler.scheduleChunk('id1', mockBuffer, 0);
        // Chunk 2: 5-10s
        scheduler.scheduleChunk('id2', mockBuffer, 5);

        // Start playing from 6s. 
        // Chunk 1 ends at 5s. 5 <= 6. Skipped.
        // Chunk 2 ends at 10s. > 6. Played.
        await scheduler.play(6);

        expect(mockCtx.createBufferSource).toHaveBeenCalledTimes(2);
    });

    it('should handle start offset in middle of chunk', async () => {
        const mockBuffer = { duration: 10 } as AudioBuffer;
        const mockSource = new MockAudioBufferSource();
        mockCtx.createBufferSource.mockReturnValue(mockSource);

        scheduler.scheduleChunk('id1', mockBuffer, 0); // 0-10s

        // Play from 3s
        await scheduler.play(3);

        const now = mockCtx.currentTime; // 0
        // Expected behavior: 
        // absoluteStartTime = start(0) + chunkStart(0) = -3
        // absoluteStartTime < now (0)? True.
        // offset = now - absoluteStartTime = 3.
        // source.start(now, 3)

        expect(mockCtx.createBufferSource).toHaveBeenCalledTimes(2);
        expect(mockSource.start).toHaveBeenCalledWith(now, 3);
    });
});
