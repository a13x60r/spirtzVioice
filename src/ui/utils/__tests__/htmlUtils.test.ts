
import { describe, it, expect } from 'vitest';
import { extractTextFromHtml } from '../htmlUtils';

describe('extractTextFromHtml', () => {
    it('extracts simple text', () => {
        const html = '<p>Hello World</p>';
        expect(extractTextFromHtml(html)).toBe('Hello World');
    });

    it('removes script tags', () => {
        const html = '<p>Hello</p><script>console.log("bad");</script><p>World</p>';
        expect(extractTextFromHtml(html).replace(/\s+/g, '')).toBe('HelloWorld');
    });

    it('removes style tags', () => {
        const html = '<style>body { color: red; }</style><p>Content</p>';
        expect(extractTextFromHtml(html)).toBe('Content');
    });

    it('handles malformed html', () => {
        const html = '<div>Broken <p>HTML';
        expect(extractTextFromHtml(html)).toBeTruthy();
    });

    it('returns empty string for empty input', () => {
        expect(extractTextFromHtml('')).toBe('');
    });
});
