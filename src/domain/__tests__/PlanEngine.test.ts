import { describe, it, expect } from 'vitest';
import { PlanEngine } from '../PlanEngine';
import { TextPipeline } from '../TextPipeline';
import type { Settings } from '@spec/types';

describe('PlanEngine', () => {
    const mockSettings: Settings = {
        voiceId: 'voice-1',
        speedWpm: 200,
        strategy: 'TOKEN',
        chunkSize: 1,
        lookaheadSec: 10,
        mode: 'RSVP',
        pauseRules: { punctPauseMs: 0, paragraphPauseMs: 0 },
        tokenizerVersion: '1',
    };

    it('should generate plan for TOKEN strategy', async () => {
        const text = 'Hello world';
        const tokens = TextPipeline.tokenize(text);
        const plan = await PlanEngine.generatePlan('doc-1', tokens, mockSettings);

        expect(plan.strategy).toBe('TOKEN');
        expect(plan.chunkSize).toBe(1);
        expect(plan.chunks).toHaveLength(2); // Hello, world (spaces skipped)
        expect(plan.chunks[0].chunkText).toBe('hello');
        expect(plan.chunks[1].chunkText).toBe('world');
    });

    it('should generate plan for CHUNK strategy', async () => {
        const text = 'One two three four';
        const tokens = TextPipeline.tokenize(text);
        const settings: Settings = { ...mockSettings, strategy: 'CHUNK', chunkSize: 4 };

        // chunkSize 4 applies to all tokens including spaces
        // One(word) + space + two(word) + space = 4 tokens

        const plan = await PlanEngine.generatePlan('doc-1', tokens, settings);

        expect(plan.strategy).toBe('CHUNK');
        // First chunk: "one two"
        // Second chunk: "three four"
        expect(plan.chunks.length).toBeGreaterThan(0);
    });

    it('should generate consistent hashes', async () => {
        const text = 'Hello';
        const tokens = TextPipeline.tokenize(text);

        const plan1 = await PlanEngine.generatePlan('doc-1', tokens, mockSettings);
        const plan2 = await PlanEngine.generatePlan('doc-2', tokens, mockSettings);

        expect(plan1.chunks[0].chunkHash).toBe(plan2.chunks[0].chunkHash);
    });
});
