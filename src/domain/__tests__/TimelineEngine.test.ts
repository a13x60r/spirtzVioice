import { describe, it, expect } from 'vitest';
import { TimelineEngine } from '../TimelineEngine';
import type { RenderPlan, AudioAsset, Token, PauseRules } from '@spec/types';

describe('TimelineEngine', () => {
    const mockPauseRules: PauseRules = {
        punctPauseMs: 100,
        paragraphPauseMs: 500,
    };

    const mockPlan: RenderPlan = {
        planId: 'plan-1',
        docId: 'doc-1',
        voiceId: 'v1',
        speedWpm: 150,
        strategy: 'TOKEN',
        chunkSize: 1,
        pauseRules: mockPauseRules,
        tokenizerVersion: '1',
        chunks: [
            {
                chunkId: 'h1',
                chunkHash: 'h1',
                startTokenIndex: 0,
                endTokenIndex: 1,
                chunkText: 'hello',
                tokenIds: ['t1']
            }
        ]
    };

    const mockAudio: AudioAsset = {
        chunkHash: 'h1',
        sampleRate: 44100,
        durationSec: 0.5,
        encoding: 'PCM_F32',
        data: new ArrayBuffer(0),
        lastAccessMs: 0,
        sizeBytes: 0
    };

    const mockTokens: Token[] = [
        {
            tokenId: 't1',
            index: 0,
            text: 'Hello',
            normText: 'hello',
            type: 'word',
            sentenceId: 0
        }
    ];

    it('should build timeline for TOKEN strategy', () => {
        const assets = new Map<string, AudioAsset>([['h1', mockAudio]]);
        const timeline = TimelineEngine.buildTimeline(mockPlan, assets, mockTokens);

        expect(timeline.entries).toHaveLength(1);
        expect(timeline.entries[0].tokenId).toBe('t1');
        expect(timeline.entries[0].tStartSec).toBe(0);
        expect(timeline.entries[0].tEndSec).toBe(0.5);
        expect(timeline.durationSec).toBe(0.5);
    });

    it('should find current token index', () => {
        const assets = new Map<string, AudioAsset>([['h1', mockAudio]]);
        const timeline = TimelineEngine.buildTimeline(mockPlan, assets, mockTokens);

        expect(TimelineEngine.getCurrentTokenIndex(timeline, 0.2)).toBe(0);
        expect(TimelineEngine.getCurrentTokenIndex(timeline, 0)).toBe(0);
        expect(TimelineEngine.getCurrentTokenIndex(timeline, 0.6)).toBe(0); // Clamped to last
    });
});
