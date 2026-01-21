import { describe, it, expect } from 'vitest';
import { stripMarkdown } from '../markdownUtils';

describe('stripMarkdown', () => {
    it('removes headers', () => {
        expect(stripMarkdown('# Heading One')).toBe('Heading One');
        expect(stripMarkdown('## Heading Two')).toBe('Heading Two');
    });

    it('removes bold and italic', () => {
        expect(stripMarkdown('**bold** and *italic*')).toBe('bold and italic');
        expect(stripMarkdown('__bold__ and _italic_')).toBe('bold and italic');
    });

    it('removes links but keeps text', () => {
        expect(stripMarkdown('[click here](https://example.com)')).toBe('click here');
    });

    it('removes images entirely', () => {
        expect(stripMarkdown('![alt text](image.png)')).toBe('');
    });

    it('removes code blocks', () => {
        const md = '```js\nconsole.log("hi");\n```';
        expect(stripMarkdown(md)).toBe('');
    });

    it('removes inline code', () => {
        expect(stripMarkdown('Use `npm install` to install')).toBe('Use npm install to install');
    });

    it('removes list markers', () => {
        expect(stripMarkdown('- item one\n- item two')).toBe('item one\nitem two');
        expect(stripMarkdown('1. first\n2. second')).toBe('first\nsecond');
    });

    it('removes blockquotes', () => {
        expect(stripMarkdown('> quoted text')).toBe('quoted text');
    });

    it('handles empty input', () => {
        expect(stripMarkdown('')).toBe('');
    });
});
