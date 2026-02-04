import { describe, it, expect } from 'vitest';
import { segmentTextToChunks } from '../segment';

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

describe('segmentTextToChunks', () => {
    it('splits on sentence punctuation', () => {
        const chunks = segmentTextToChunks('Hello there world. Next part here!');
        expect(chunks).toHaveLength(2);
        expect(chunks[0].text).toBe('Hello there world.');
        expect(chunks[1].text).toBe('Next part here!');
    });

    it('splits on comma before conjunctions', () => {
        const chunks = segmentTextToChunks('We paused briefly, and then continued.');
        expect(chunks).toHaveLength(2);
        expect(chunks[0].text).toBe('We paused briefly,');
        expect(chunks[1].text).toBe('and then continued.');
    });

    it('merges tiny chunks into the next', () => {
        const chunks = segmentTextToChunks('Yes. This is the real start.');
        expect(chunks).toHaveLength(1);
        expect(chunks[0].text).toBe('Yes. This is the real start.');
    });

    it('caps chunk length to 12-15 words', () => {
        const text = 'One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen';
        const chunks = segmentTextToChunks(text);
        const wordCounts = chunks.map(c => countWords(c.text));
        wordCounts.forEach(count => {
            expect(count).toBeLessThanOrEqual(15);
        });
    });
});
