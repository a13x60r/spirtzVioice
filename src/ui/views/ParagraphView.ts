import type { Token } from '@spec/types';
import type { ReaderView } from './ViewInterface';

export class ParagraphView implements ReaderView {
    private container: HTMLElement | null = null;
    private contentEl: HTMLElement | null = null;
    private tokenEls: Map<number, HTMLElement> = new Map();
    private activeTokenIndex: number = -1;

    mount(container: HTMLElement): void {
        this.container = container;
        this.container.innerHTML = `
            <div class="paragraph-container" id="paragraph-content">
                <!-- Content injected here -->
            </div>
        `;
        this.contentEl = this.container.querySelector('#paragraph-content');
    }

    unmount(): void {
        if (this.container) {
            this.container.innerHTML = '';
            this.container = null;
            this.contentEl = null;
            this.tokenEls.clear();
        }
    }

    /**
     * Re-renders the full text. expensive, call only on load.
     */
    renderText(tokens: Token[]) {
        if (!this.contentEl) return;

        this.contentEl.innerHTML = '';
        this.tokenEls.clear();

        const fragment = document.createDocumentFragment();

        tokens.forEach((token, index) => {
            const span = document.createElement('span');
            span.textContent = token.text;
            span.className = 'token';
            span.dataset.index = String(index);

            // Handle spacing (naive for now, TextPipeline handles it better ideally)
            // If the token is punctuation or explicit space, we might just render it.
            // But if we output pure tokens, we might miss spaces if they are separate tokens.
            // Assumption: tokens array contains EVERYTHING including spaces.

            if (token.type === 'newline') {
                fragment.appendChild(document.createElement('br'));
                fragment.appendChild(document.createElement('br')); // Double break for para
                return;
            }

            this.tokenEls.set(index, span);
            fragment.appendChild(span);
        });

        this.contentEl.appendChild(fragment);
    }

    update(tokenIndex: number, tokens: Token[]): void {
        if (!this.contentEl) return;

        // If first update (or content mismatch), render text
        if (this.tokenEls.size === 0 && tokens.length > 0) {
            this.renderText(tokens);
        }

        if (this.activeTokenIndex !== -1) {
            const prevEl = this.tokenEls.get(this.activeTokenIndex);
            if (prevEl) prevEl.classList.remove('active');
        }

        this.activeTokenIndex = tokenIndex;
        const currEl = this.tokenEls.get(tokenIndex);

        if (currEl) {
            currEl.classList.add('active');

            // Auto-scroll logic
            currEl.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }

    setTheme(_theme: string): void {
        // Theme logic
    }
}
