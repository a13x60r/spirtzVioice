import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioEngine } from '@audio/AudioEngine';
import { audioStore } from '@storage/AudioStore';
import { documentStore } from '@storage/DocumentStore';
import { TextPipeline } from '@domain/TextPipeline';
import { Settings } from '@spec/types';

// Mocks
const mockWorkerPostMessage = vi.fn();
const mockWorkerTerminate = vi.fn();

class MockWorker {
    onmessage: ((event: any) => void) | null = null;
    postMessage = mockWorkerPostMessage;
    terminate = mockWorkerTerminate;

    constructor() {
        console.log("MockWorker initialized");
        // Simulate worker response for init
        setTimeout(() => {
            this.onmessage?.({ data: { type: 'INIT_COMPLETE' } });
        }, 10);
    }
}

// Mock decodeAudioData
const mockDecodeAudioData = vi.fn().mockImplementation((_buffer) => {
    return Promise.resolve({
        duration: 1.0, // Mock 1 sec duration
        sampleRate: 44100,
        numberOfChannels: 1,
        getChannelData: () => new Float32Array(44100)
    });
});

const mockAudioContext = {
    state: 'suspended',
    currentTime: 0,
    resume: vi.fn().mockResolvedValue(undefined),
    suspend: vi.fn().mockResolvedValue(undefined),
    createBufferSource: () => ({
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        playbackRate: { value: 1 },
        onended: null,
        buffer: null
    }),
    createGain: () => ({
        connect: vi.fn(),
        gain: { value: 1 }
    }),
    createBuffer: () => ({}),
    decodeAudioData: mockDecodeAudioData,
    destination: {}
};

const injectMetadataCtx = (instance: AudioEngine) => {
    (instance as any).metadataCtx = { decodeAudioData: mockDecodeAudioData };
};

describe('Integration: Core Flow', () => {
    let engine: AudioEngine;

    beforeEach(() => {
        mockDecodeAudioData.mockImplementation((_buffer) => {
            return Promise.resolve({
                duration: 1.0,
                sampleRate: 44100,
                numberOfChannels: 1,
                getChannelData: () => new Float32Array(44100)
            });
        });
        vi.stubGlobal('Worker', MockWorker);
        vi.stubGlobal('AudioContext', vi.fn(() => mockAudioContext));
        vi.stubGlobal('OfflineAudioContext', vi.fn(() => ({ decodeAudioData: mockDecodeAudioData })));
        vi.stubGlobal('window', {
            ...window,
            setInterval: window.setInterval,
            clearInterval: window.clearInterval,
            setTimeout: window.setTimeout,
            clearTimeout: window.clearTimeout,
            location: window.location ?? { origin: 'http://localhost' }
        });

        vi.spyOn(audioStore, 'getChunk').mockResolvedValue({
            data: new Blob([new ArrayBuffer(10)]),
            durationSec: 1.0
        } as any);

        // Reset DB mocks if needed? fake-indexeddb handles in-memory

        // Mock worker logic to respond to SYNTHESIZE_CHUNK
        mockWorkerPostMessage.mockImplementation(function (this: MockWorker, msg: any) {
            if (msg.type === 'SYNTHESIZE_CHUNK') {
                const { chunkHash } = msg.payload;
                // Reply with fake audio
                setTimeout(() => {
                    this.onmessage?.({
                        data: {
                            type: 'CHUNK_COMPLETE',
                            payload: {
                                chunkHash,
                                audioData: new ArrayBuffer(100) // Fake PCM
                            }
                        }
                    });
                }, 10);
            } else if (msg.type === 'LOAD_VOICE') {
                const { voiceId } = msg.payload;
                setTimeout(() => {
                    this.onmessage?.({
                        data: {
                            type: 'VOICE_LOADED',
                            payload: { voiceId }
                        }
                    });
                }, 10);
            }
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should load a document, synthesize, and play', async () => {
        // 1. Create Document
        const doc = await documentStore.createDocument("Test Doc", "Hello world this is a test.");
        expect(doc.id).toBeDefined();

        // 2. Tokenize
        const tokens = TextPipeline.tokenize(doc.originalText);
        expect(tokens.length).toBeGreaterThan(0);

        // 3. Init Engine
        engine = new AudioEngine();
        injectMetadataCtx(engine);
        const settings: Settings = {
            voiceId: 'default',
            language: 'en-US',
            speedWpm: 300,
            strategy: 'TOKEN',
            chunkSize: 5,
            lookaheadSec: 10,
            mode: 'RSVP',
            pauseRules: { punctPauseMs: 0, paragraphPauseMs: 0 },
            tokenizerVersion: '1'
        };

        // 4. Load Document (Triggers Synthesis)
        await engine.loadDocument(doc.id, tokens, settings);

        // Assertions after load
        const controller = engine.getController();
        expect(controller.getState()).toBe('PAUSED');
        // We can't easily peek into private engine state, but if loadDocument settled, it means chunks were "synthesized" and timeline built.

        // 5. Play
        // Mock AudioScheduler time progression?
        // For now, just call play and check state
        await controller.play();
        expect(controller.getState()).toBe('PLAYING');

        // 6. Simulate simple tick
        // controller.tick() is private, but we can verify startLoop called setInterval (implied by state 'PLAYING' in our mock PlaybackController if we trusted it, 
        // but here we are using the REAL PlaybackController logic with MOCKED AudioSystem).

        // 7. Pause
        await controller.pause();
        expect(controller.getState()).toBe('PAUSED');

        // Success
    });

    it('should preserve token position when WPM changes', async () => {
        const doc = await documentStore.createDocument(
            "WPM Test",
            "one two three four five six seven eight nine ten"
        );

        const tokens = TextPipeline.tokenize(doc.originalText);
        expect(tokens.length).toBeGreaterThan(7);

        engine = new AudioEngine();
        injectMetadataCtx(engine);
        const settings: Settings = {
            voiceId: 'default',
            language: 'en-US',
            speedWpm: 300,
            strategy: 'TOKEN',
            chunkSize: 5,
            lookaheadSec: 10,
            mode: 'RSVP',
            pauseRules: { punctPauseMs: 0, paragraphPauseMs: 0 },
            tokenizerVersion: '1'
        };

        const startTokenIndex = 6;
        await engine.loadDocument(doc.id, tokens, settings, startTokenIndex);

        const controller = engine.getController();
        expect(controller.getCurrentTokenIndex()).toBe(startTokenIndex);

        const updatedSettings: Settings = {
            ...settings,
            speedWpm: 450
        };

        await engine.updateSettings(updatedSettings);

        expect(controller.getCurrentTokenIndex()).toBe(startTokenIndex);
    });
});
