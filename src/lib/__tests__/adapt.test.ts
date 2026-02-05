import { describe, it, expect } from 'vitest';
import { createAdaptState, evaluateAdaptation, recordRewind } from '../adapt';

describe('adaptation', () => {
    it('slows down after two rewinds in 30s', () => {
        const state = createAdaptState();
        const now = 100_000;
        recordRewind(now - 10_000, state);
        recordRewind(now - 5_000, state);

        const result = evaluateAdaptation(now, 200, state);
        expect(result?.reason).toBe('slowdown');
        expect(result?.nextWpm).toBe(180);
    });

    it('speeds up after 2 minutes of stability', () => {
        const state = createAdaptState();
        const start = 100_000;
        const ready = start + 120_000;

        const result = evaluateAdaptation(start, 200, state);
        expect(result).toBeNull();

        const result2 = evaluateAdaptation(ready, 200, state);
        expect(result2?.reason).toBe('speedup');
        expect(result2?.nextWpm).toBe(206);
    });

    it('clamps to min and max wpm', () => {
        const state = createAdaptState();
        const now = 200_000;
        recordRewind(now - 10_000, state);
        recordRewind(now - 5_000, state);

        const slowResult = evaluateAdaptation(now, 140, state);
        expect(slowResult).toBeNull();

        const speedState = createAdaptState();
        const ready = 200_000 + 120_000;
        evaluateAdaptation(200_000, 360, speedState);
        const fastResult = evaluateAdaptation(ready, 360, speedState);
        expect(fastResult).toBeNull();
    });
});
