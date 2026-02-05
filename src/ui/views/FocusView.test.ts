import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FocusView } from './FocusView';
import type { ReaderChunk } from '../../lib/readerModel';
import type { Token } from '@spec/types';

describe('FocusView', () => {
    let view: FocusView;
    let container: HTMLElement;

    beforeEach(() => {
        vi.useFakeTimers();
        view = new FocusView();
        container = document.createElement('div');
        view.mount(container);
    });

    afterEach(() => {
        vi.useRealTimers();
        view.unmount();
    });

    it('renders a paging button', () => {
        const pagingBtn = container.querySelector('#focus-paging-btn');
        expect(pagingBtn).toBeTruthy();
    });

    it('calls panic exit on paging button click', () => {
        const handler = vi.fn();
        view.setPanicExitHandler(handler);

        const pagingBtn = container.querySelector('#focus-paging-btn') as HTMLButtonElement;
        pagingBtn.click();

        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('calls panic exit on long press', () => {
        const handler = vi.fn();
        view.setPanicExitHandler(handler);

        const focusContainer = container.querySelector('.focus-container') as HTMLElement;
        focusContainer.dispatchEvent(new Event('pointerdown', { bubbles: true }));

        vi.advanceTimersByTime(500);

        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('does not call panic exit if released early', () => {
        const handler = vi.fn();
        view.setPanicExitHandler(handler);

        const focusContainer = container.querySelector('.focus-container') as HTMLElement;
        focusContainer.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        vi.advanceTimersByTime(200);
        focusContainer.dispatchEvent(new Event('pointerup', { bubbles: true }));
        vi.advanceTimersByTime(400);

        expect(handler).not.toHaveBeenCalled();
    });

    it('renders previous, current, and next chunks', () => {
        const chunks: ReaderChunk[] = [
            { id: '1', text: 'First chunk', startOffset: 0, endOffset: 11, sentenceId: 0, paraId: 0 },
            { id: '2', text: 'Second chunk', startOffset: 12, endOffset: 24, sentenceId: 0, paraId: 0 },
            { id: '3', text: 'Third chunk', startOffset: 25, endOffset: 36, sentenceId: 0, paraId: 0 }
        ];

        view.update(1, chunks);

        const prev = container.querySelector('#focus-prev');
        const current = container.querySelector('#focus-chunk');
        const next = container.querySelector('#focus-next');

        expect(prev?.textContent).toBe('First chunk');
        expect(current?.textContent).toBe('Second chunk');
        expect(next?.textContent).toBe('Third chunk');
    });

    it('clears ghost lines at boundaries', () => {
        const chunks: ReaderChunk[] = [
            { id: '1', text: 'First chunk', startOffset: 0, endOffset: 11, sentenceId: 0, paraId: 0 },
            { id: '2', text: 'Second chunk', startOffset: 12, endOffset: 24, sentenceId: 0, paraId: 0 }
        ];

        view.update(0, chunks);

        const prev = container.querySelector('#focus-prev');
        const current = container.querySelector('#focus-chunk');
        const next = container.querySelector('#focus-next');

        expect(prev?.textContent).toBe('');
        expect(current?.textContent).toBe('First chunk');
        expect(next?.textContent).toBe('Second chunk');
    });

    it('aligns ORP with active token within a chunk', () => {
        const chunks: ReaderChunk[] = [
            { id: '1', text: 'Hello world', startOffset: 0, endOffset: 11, sentenceId: 0, paraId: 0 }
        ];
        const tokens: Token[] = [
            { index: 0, tokenId: 't0', text: 'Hello', normText: 'hello', startOffset: 0, endOffset: 5, type: 'word', sentenceId: 0 },
            { index: 1, tokenId: 't1', text: 'world', normText: 'world', startOffset: 6, endOffset: 11, type: 'word', sentenceId: 0 }
        ];

        view.update(0, chunks, 0, tokens);
        let focusChunk = container.querySelector('#focus-chunk') as HTMLElement;
        let orp = focusChunk.querySelector('.focus-orp') as HTMLElement;
        expect(orp?.textContent).toBe('e');

        view.update(0, chunks, 1, tokens);
        focusChunk = container.querySelector('#focus-chunk') as HTMLElement;
        orp = focusChunk.querySelector('.focus-orp') as HTMLElement;
        expect(orp?.textContent).toBe('o');
    });
});
