import type { ReaderChunk } from '../../lib/readerModel';
import type { ReaderView } from './ViewInterface';

export class FocusView implements ReaderView {
    private container: HTMLElement | null = null;
    private prevChunkEl: HTMLElement | null = null;
    private chunkEl: HTMLElement | null = null;
    private nextChunkEl: HTMLElement | null = null;
    private currentChunkIndex: number = -1;
    private focusContainer: HTMLElement | null = null;
    private pagingBtn: HTMLButtonElement | null = null;
    private longPressTimer: number | null = null;
    private onPanicExit: (() => void) | null = null;

    private handlePointerDown = (event: PointerEvent) => {
        if (this.isPagingButtonEvent(event)) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;

        this.clearLongPressTimer();
        this.longPressTimer = window.setTimeout(() => {
            this.onPanicExit?.();
        }, 500);
    };

    private handlePointerUp = () => {
        this.clearLongPressTimer();
    };

    private handlePointerCancel = () => {
        this.clearLongPressTimer();
    };

    private handlePagingClick = (event: Event) => {
        event.stopPropagation();
        this.onPanicExit?.();
    };

    private handlePagingPointerDown = (event: Event) => {
        event.stopPropagation();
    };

    setPanicExitHandler(handler: (() => void) | null): void {
        this.onPanicExit = handler;
    }

    mount(container: HTMLElement): void {
        this.container = container;
        this.container.innerHTML = `
            <div class="focus-container">
                <button class="btn btn-secondary btn-sm focus-paging-btn" id="focus-paging-btn" type="button">Paging</button>
                <div class="focus-lines" id="focus-lines">
                    <div class="focus-chunk focus-ghost" id="focus-prev"></div>
                    <div class="focus-chunk focus-current" id="focus-chunk"></div>
                    <div class="focus-chunk focus-ghost" id="focus-next"></div>
                </div>
            </div>
        `;
        this.prevChunkEl = this.container.querySelector('#focus-prev');
        this.chunkEl = this.container.querySelector('#focus-chunk');
        this.nextChunkEl = this.container.querySelector('#focus-next');
        this.focusContainer = this.container.querySelector('.focus-container');
        this.pagingBtn = this.container.querySelector('#focus-paging-btn');

        if (this.focusContainer) {
            this.focusContainer.addEventListener('pointerdown', this.handlePointerDown);
            this.focusContainer.addEventListener('pointerup', this.handlePointerUp);
            this.focusContainer.addEventListener('pointerleave', this.handlePointerCancel);
            this.focusContainer.addEventListener('pointercancel', this.handlePointerCancel);
        }

        if (this.pagingBtn) {
            this.pagingBtn.addEventListener('click', this.handlePagingClick);
            this.pagingBtn.addEventListener('pointerdown', this.handlePagingPointerDown);
        }
    }

    unmount(): void {
        this.clearLongPressTimer();
        if (this.focusContainer) {
            this.focusContainer.removeEventListener('pointerdown', this.handlePointerDown);
            this.focusContainer.removeEventListener('pointerup', this.handlePointerUp);
            this.focusContainer.removeEventListener('pointerleave', this.handlePointerCancel);
            this.focusContainer.removeEventListener('pointercancel', this.handlePointerCancel);
        }
        if (this.pagingBtn) {
            this.pagingBtn.removeEventListener('click', this.handlePagingClick);
            this.pagingBtn.removeEventListener('pointerdown', this.handlePagingPointerDown);
        }
        if (this.container) {
            this.container.innerHTML = '';
            this.container = null;
            this.prevChunkEl = null;
            this.chunkEl = null;
            this.nextChunkEl = null;
            this.currentChunkIndex = -1;
            this.focusContainer = null;
            this.pagingBtn = null;
        }
    }

    update(chunkIndex: number, chunks: ReaderChunk[]): void {
        if (!this.chunkEl || !this.prevChunkEl || !this.nextChunkEl || !chunks || chunks.length === 0) return;
        if (this.currentChunkIndex === chunkIndex) return;
        this.currentChunkIndex = chunkIndex;

        const chunk = chunks[chunkIndex];
        const prevChunk = chunkIndex > 0 ? chunks[chunkIndex - 1] : null;
        const nextChunk = chunkIndex < chunks.length - 1 ? chunks[chunkIndex + 1] : null;
        if (chunk) {
            this.prevChunkEl.textContent = prevChunk?.text ?? '';
            this.chunkEl.textContent = chunk.text;
            this.nextChunkEl.textContent = nextChunk?.text ?? '';
        }
    }

    setTheme(_theme: string): void {
        // Theme handling if needed later
    }

    private clearLongPressTimer() {
        if (this.longPressTimer !== null) {
            window.clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    }

    private isPagingButtonEvent(event: Event): boolean {
        const target = event.target as HTMLElement | null;
        return Boolean(target?.closest('#focus-paging-btn'));
    }
}
