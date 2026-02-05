import { describe, it, expect } from 'vitest';
import { prevChunk, prevSentence, rewindByMs } from '../navigation';

describe('navigation helpers', () => {
    it('prevChunk clamps to range', () => {
        const chunks = [{ id: 'a' }, { id: 'b' }, { id: 'c' }] as any;
        expect(prevChunk(2, chunks)).toBe(1);
        expect(prevChunk(0, chunks)).toBe(0);
    });

    it('prevSentence finds start of previous sentence', () => {
        const tokens = [
            { index: 0, sentenceId: 0 },
            { index: 1, sentenceId: 0 },
            { index: 2, sentenceId: 1 },
            { index: 3, sentenceId: 1 },
            { index: 4, sentenceId: 2 }
        ] as any;

        expect(prevSentence(3, tokens)).toBe(2);
        expect(prevSentence(0, tokens)).toBe(0);
    });

    it('rewindByMs clamps to duration', () => {
        expect(rewindByMs(10, 5000, 20)).toBe(5);
        expect(rewindByMs(2, 5000, 20)).toBe(0);
    });
});
