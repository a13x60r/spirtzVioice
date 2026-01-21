import type { Token } from '@spec/types';
import type { ReaderView } from './ViewInterface';
import { marked } from 'marked';

export class ParagraphView implements ReaderView {
    private container: HTMLElement | null = null;
    private contentEl: HTMLElement | null = null;
    private tokenEls: Map<number, HTMLElement> = new Map();
    private activeTokenIndex: number = -1;

    // New context
    private originalText: string = '';
    private contentType: 'text' | 'html' | 'markdown' = 'text';

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

    setDocumentContext(originalText: string, contentType: 'text' | 'html' | 'markdown') {
        this.originalText = originalText;
        this.contentType = contentType;
        // Reset rendered state so next update/render triggers full render
        if (this.contentEl) this.contentEl.innerHTML = '';
        this.tokenEls.clear();
    }

    /**
     * Re-renders the text based on content type.
     */
    renderText(tokens: Token[]) {
        if (!this.contentEl) return;

        this.contentEl.innerHTML = '';
        this.tokenEls.clear();

        if (this.contentType === 'html') {
            this.contentEl.innerHTML = this.originalText;
            // TODO: implement highlighting for HTML if possible
            return;
        } else if (this.contentType === 'markdown') {
            const html = marked.parse(this.originalText);
            this.contentEl.innerHTML = html as string; // marked.parse returns string
            return;
        }

        // Default: Plain Text (Tokenized)
        const fragment = document.createDocumentFragment();

        tokens.forEach((token, index) => {
            const span = document.createElement('span');
            span.textContent = token.text;
            span.className = 'token';
            span.dataset.index = String(index);

            if (token.type === 'newline') {
                fragment.appendChild(document.createElement('br'));
                fragment.appendChild(document.createElement('br'));
                return;
            }

            this.tokenEls.set(index, span);
            fragment.appendChild(span);
        });

        this.contentEl.appendChild(fragment);
    }

    update(tokenIndex: number, tokens: Token[]): void {
        if (!this.contentEl) return;

        // If content is empty (and we have something to show), render.
        // For HTML/MD, we look at originalText. For Text, we look at tokens.
        const shouldRender = this.contentEl.children.length === 0;

        if (shouldRender) {
            if (this.contentType !== 'text' && this.originalText) {
                this.renderText(tokens);
            } else if (tokens.length > 0) {
                this.renderText(tokens);
            }
        }

        // Highlighting logic - only for TEXT mode for now
        if (this.contentType === 'text') {
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
    }

    setTheme(_theme: string): void {
        // Theme logic
    }
}
