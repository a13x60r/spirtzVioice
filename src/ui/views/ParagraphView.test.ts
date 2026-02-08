
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ParagraphView } from './ParagraphView';
import type { Token } from '@spec/types';

describe('ParagraphView', () => {
    let view: ParagraphView;
    let container: HTMLElement;

    beforeEach(() => {
        Element.prototype.scrollIntoView = vi.fn();
        view = new ParagraphView();
        container = document.createElement('div');
        view.mount(container);
    });

    it('should result nested container', () => {
        expect(container.querySelector('#paragraph-content')).toBeTruthy();
    });

    it('should render tokens for plain text', () => {
        view.setDocumentContext('Hello world', 'text', 'Hello world');
        const tokens: Token[] = [
            { tokenId: '1', index: 0, text: 'Hello', normText: 'hello', type: 'word', sentenceId: 0, startOffset: 0, endOffset: 5 },
            { tokenId: '2', index: 1, text: ' ', normText: '', type: 'space', sentenceId: 0, startOffset: 5, endOffset: 6 },
            { tokenId: '3', index: 2, text: 'world', normText: 'world', type: 'word', sentenceId: 0, startOffset: 6, endOffset: 11 }
        ];

        view.update(0, tokens);
        const content = container.querySelector('#paragraph-content');
        expect(content?.textContent).toContain('Hello world');
        expect(content?.querySelectorAll('.token').length).toBe(3);
    });

    it('should render markdown using setDocumentContext', () => {
        view.setDocumentContext('# Header\n**Bold**', 'markdown', 'Header Bold');
        // update triggers render
        view.update(0, []);

        const content = container.querySelector('#paragraph-content');
        expect(content?.innerHTML).toContain('<h1');
        expect(content?.innerHTML).toContain('Header</h1>');
        expect(content?.innerHTML).toContain('<strong');
        expect(content?.innerHTML).toContain('Bold</strong>');
    });

    it('should render HTML using setDocumentContext', () => {
        const html = '<div class="custom">My HTML</div>';
        view.setDocumentContext(html, 'html', 'My HTML');
        view.update(0, []);

        const content = container.querySelector('#paragraph-content');
        expect(content?.innerHTML).toContain('<div class="custom">My HTML</div>');
    });

    it('should clear content when setDocumentContext is called', () => {
        view.setDocumentContext('First', 'text', 'First');
        view.update(0, [{ tokenId: '1', index: 0, text: 'First', normText: 'first', type: 'word', sentenceId: 0, startOffset: 0, endOffset: 5 }]);
        expect(container.textContent).toContain('First');

        view.setDocumentContext('Second', 'text', 'Second');
        expect(container.querySelector('#paragraph-content')?.innerHTML).toBe('');
    });
});
