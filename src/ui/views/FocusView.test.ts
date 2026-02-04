import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FocusView } from './FocusView';

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
});
