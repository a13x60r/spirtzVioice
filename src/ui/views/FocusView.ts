import type { ReaderChunk } from '../../lib/readerModel';
import type { ReaderView } from './ViewInterface';

export class FocusView implements ReaderView {
    private container: HTMLElement | null = null;
    private chunkEl: HTMLElement | null = null;
    private currentChunkIndex: number = -1;

    mount(container: HTMLElement): void {
        this.container = container;
        this.container.innerHTML = `
            <div class="focus-container">
                <div class="focus-chunk" id="focus-chunk"></div>
            </div>
        `;
        this.chunkEl = this.container.querySelector('#focus-chunk');
    }

    unmount(): void {
        if (this.container) {
            this.container.innerHTML = '';
            this.container = null;
            this.chunkEl = null;
            this.currentChunkIndex = -1;
        }
    }

    update(chunkIndex: number, chunks: ReaderChunk[]): void {
        if (!this.chunkEl || !chunks || chunks.length === 0) return;
        if (this.currentChunkIndex === chunkIndex) return;
        this.currentChunkIndex = chunkIndex;

        const chunk = chunks[chunkIndex];
        if (chunk) {
            this.chunkEl.textContent = chunk.text;
        }
    }

    setTheme(_theme: string): void {
        // Theme handling if needed later
    }
}
