import { describe, it, expect } from 'vitest';
import {
    getOrpIndex,
    getOrp,
    getOrpIndexLettersOnly,
    getOrpLettersOnly,
    splitForHighlight,
    tokenize
} from '../orp';

describe('orp utils', () => {
    describe('getOrpIndex', () => {
        it('returns first index for short words', () => {
            expect(getOrpIndex('')).toBe(0);
            expect(getOrpIndex('a')).toBe(0);
            expect(getOrpIndex('ok')).toBe(0);
        });

        it('returns second index for length 3-5', () => {
            expect(getOrpIndex('cat')).toBe(1);
            expect(getOrpIndex('four')).toBe(1);
            expect(getOrpIndex('five!')).toBe(1);
        });

        it('returns third index for length 6-9', () => {
            expect(getOrpIndex('orange')).toBe(2);
            expect(getOrpIndex('seven77')).toBe(2);
            expect(getOrpIndex('nine nine')).toBe(2);
        });

        it('returns fourth index for length 10+', () => {
            expect(getOrpIndex('strawberry')).toBe(3);
            expect(getOrpIndex('extraordinary')).toBe(3);
        });
    });

    describe('getOrp', () => {
        it('returns the orp character', () => {
            const result = getOrp('hello');
            expect(result.orpIndex).toBe(1);
            expect(result.orpChar).toBe('e');
        });
    });

    describe('getOrpIndexLettersOnly', () => {
        it('uses letters only for punctuation-heavy words', () => {
            expect(getOrpIndexLettersOnly('"hello,"')).toBe(2);
            expect(getOrpIndexLettersOnly('end.')).toBe(1);
        });

        it('returns 0 when no letters or numbers', () => {
            expect(getOrpIndexLettersOnly('...')).toBe(0);
            expect(getOrpIndexLettersOnly('""')).toBe(0);
        });
    });

    describe('getOrpLettersOnly', () => {
        it('returns the letter-based orp character', () => {
            const result = getOrpLettersOnly('"hello"');
            expect(result.orpIndex).toBe(2);
            expect(result.orpChar).toBe('e');
        });
    });

    describe('splitForHighlight', () => {
        it('splits the word into prefix, mid, suffix', () => {
            expect(splitForHighlight('hello', 1)).toEqual(['h', 'e', 'llo']);
        });

        it('clamps indices that are out of bounds', () => {
            expect(splitForHighlight('hi', 9)).toEqual(['h', 'i', '']);
            expect(splitForHighlight('hi', -4)).toEqual(['', 'h', 'i']);
        });
    });

    describe('tokenize', () => {
        it('splits text on whitespace', () => {
            expect(tokenize('one two\nthree')).toEqual(['one', 'two', 'three']);
        });

        it('drops empty tokens', () => {
            expect(tokenize('  spaced   out  ')).toEqual(['spaced', 'out']);
        });
    });
});
