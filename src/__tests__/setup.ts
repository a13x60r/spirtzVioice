import { vi } from 'vitest';

class MockGainNode {
    gain = { value: 1 };
    connect = vi.fn();
}

class MockAudioBufferSourceNode {
    buffer: AudioBuffer | null = null;
    playbackRate = { value: 1 };
    loop = false;
    connect = vi.fn();
    disconnect = vi.fn();
    start = vi.fn();
    stop = vi.fn();
    onended: (() => void) | null = null;
}

class MockAudioContext {
    state: AudioContextState = 'suspended';
    currentTime = 0;
    sampleRate = 44100;
    baseLatency = 0;
    destination = {};
    suspend = vi.fn().mockResolvedValue(undefined);
    resume = vi.fn().mockResolvedValue(undefined);
    createGain = vi.fn().mockReturnValue(new MockGainNode());
    createBufferSource = vi.fn().mockReturnValue(new MockAudioBufferSourceNode());
    createBuffer = vi.fn().mockReturnValue({});
    decodeAudioData = vi.fn().mockResolvedValue({
        duration: 1,
        sampleRate: 44100,
        numberOfChannels: 1,
        getChannelData: () => new Float32Array(1)
    });
}

class MockOfflineAudioContext {
    sampleRate = 44100;
    constructor(_channels: number, _length: number, sampleRate: number) {
        this.sampleRate = sampleRate;
    }

    decodeAudioData = vi.fn().mockResolvedValue({
        duration: 1,
        sampleRate: 44100,
        numberOfChannels: 1,
        getChannelData: () => new Float32Array(1)
    });
}

class MockWorker {
    onmessage: ((event: MessageEvent) => void) | null = null;
    postMessage = vi.fn();
    terminate = vi.fn();
}

class MockBroadcastChannel {
    name: string;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onmessageerror: ((event: MessageEvent) => void) | null = null;

    constructor(name: string) {
        this.name = name;
    }

    postMessage = vi.fn();
    close = vi.fn();
    addEventListener = vi.fn();
    removeEventListener = vi.fn();
    dispatchEvent = vi.fn().mockReturnValue(true);
}

const globalTarget = globalThis as typeof globalThis & {
    AudioContext?: typeof AudioContext;
    OfflineAudioContext?: typeof OfflineAudioContext;
    Worker?: typeof Worker;
    BroadcastChannel?: typeof BroadcastChannel;
};

if (!globalTarget.AudioContext) {
    globalTarget.AudioContext = MockAudioContext as unknown as typeof AudioContext;
}

if (!globalTarget.OfflineAudioContext) {
    globalTarget.OfflineAudioContext = MockOfflineAudioContext as unknown as typeof OfflineAudioContext;
}

if (!globalTarget.Worker) {
    globalTarget.Worker = MockWorker as unknown as typeof Worker;
}

if (!globalTarget.BroadcastChannel) {
    globalTarget.BroadcastChannel = MockBroadcastChannel as unknown as typeof BroadcastChannel;
}
