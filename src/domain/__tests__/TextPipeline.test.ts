import { describe, it, expect } from 'vitest';
import { TextPipeline } from '../TextPipeline';

describe('TextPipeline', () => {
    describe('tokenize', () => {
        it('should split simple text into words and spaces', () => {
            const text = 'Hello world';
            const tokens = TextPipeline.tokenize(text);

            expect(tokens).toHaveLength(3);
            expect(tokens[0].text).toBe('Hello');
            expect(tokens[0].type).toBe('word');
            expect(tokens[1].text).toBe(' ');
            expect(tokens[1].type).toBe('space');
            expect(tokens[2].text).toBe('world');
            expect(tokens[2].type).toBe('word');
        });

        it('should handle punctuation correctly', () => {
            const text = 'Hello, world!';
            const tokens = TextPipeline.tokenize(text);

            expect(tokens.map(t => t.text)).toEqual(['Hello', ',', ' ', 'world', '!']);
            expect(tokens[1].type).toBe('punct');
            expect(tokens[4].type).toBe('punct');
        });

        it('should normalize text for TTS', () => {
            const text = 'Hello!';
            const tokens = TextPipeline.tokenize(text);

            expect(tokens[0].normText).toBe('hello');
            expect(tokens[1].normText).toBe('!'); // Prosody punctuation preserved
        });

        it('should assign sentence IDs correctly', () => {
            const text = 'First sentence. Second sentence? Third!';
            const tokens = TextPipeline.tokenize(text);

            const first = tokens.find(t => t.text === 'First');
            const second = tokens.find(t => t.text === 'Second');
            const third = tokens.find(t => t.text === 'Third');

            expect(first?.sentenceId).toBe(0);
            expect(second?.sentenceId).toBe(1);
            expect(third?.sentenceId).toBe(2);
        });

        it('should handle newlines as paragraph breaks', () => {
            const text = 'Para 1.\n\nPara 2.';
            const tokens = TextPipeline.tokenize(text);

            const p1 = tokens.find(t => t.text === '1');
            const p2 = tokens.find(t => t.text === '2');

            expect(p1?.sentenceId).not.toBe(p2?.sentenceId);
        });
    });
});
