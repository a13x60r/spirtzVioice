import { describe, expect, it } from 'vitest';
import { computeDelayMs } from '../timing';

describe('computeDelayMs', () => {
    it('calculates base delay from word count and WPM', () => {
        const delay = computeDelayMs('one two three', 300);
        expect(delay).toBe(600);
    });

    it('adds punctuation pauses', () => {
        const delay = computeDelayMs('Wait, pause; stop!', 300);
        expect(delay).toBe(1370);
    });

    it('adds long word bonus for words length >= 9', () => {
        const delay = computeDelayMs('extraordinary reading', 240);
        expect(delay).toBe(535);
    });

    it('handles punctuation attached to long words', () => {
        const delay = computeDelayMs('astonishing!', 300);
        expect(delay).toBe(200 + 450 + 35);
    });
});
