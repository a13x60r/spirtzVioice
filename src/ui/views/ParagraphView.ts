import type { Token } from '@spec/types';
import type { ReaderView } from './ViewInterface';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export class ParagraphView implements ReaderView {
    private container: HTMLElement | null = null;
    private contentEl: HTMLElement | null = null;
    private tokenEls: Map<number, HTMLElement> = new Map();
    private activeTokenIndex: number = -1;
    private onScroll: ((scrollTop: number) => void) | null = null;

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
        if (this.contentEl) {
            this.contentEl.addEventListener('scroll', this.handleScroll);
        }
    }

    unmount(): void {
        if (this.container) {
            if (this.contentEl) {
                this.contentEl.removeEventListener('scroll', this.handleScroll);
            }
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
            const clean = DOMPurify.sanitize(this.originalText);
            this.contentEl.innerHTML = this.stripExternalImages(clean);
            // TODO: implement highlighting for HTML if possible
            return;
        } else if (this.contentType === 'markdown') {
            const html = marked.parse(this.originalText);
            const clean = DOMPurify.sanitize(html as string);
            this.contentEl.innerHTML = this.stripExternalImages(clean);
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

    getScrollTop(): number {
        if (!this.contentEl) return 0;
        return this.contentEl.scrollTop;
    }

    setScrollTop(value: number) {
        if (!this.contentEl) return;
        this.contentEl.scrollTop = value;
    }

    setTheme(_theme: string): void {
        // Theme logic
    }

    setScrollHandler(handler: ((scrollTop: number) => void) | null) {
        this.onScroll = handler;
    }

    private stripExternalImages(html: string): string {
        const template = document.createElement('template');
        template.innerHTML = html;

        const images = template.content.querySelectorAll('img');
        images.forEach(img => {
            const src = img.getAttribute('src') || '';
            if (!src) return;
            if (this.isExternalImageUrl(src)) img.remove();
        });

        return template.innerHTML;
    }

    private isExternalImageUrl(src: string): boolean {
        try {
            const url = new URL(src, window.location.origin);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
            return url.origin !== window.location.origin;
        } catch {
            return false;
        }
    }

    private handleScroll = () => {
        if (!this.contentEl || !this.onScroll) return;
        this.onScroll(this.contentEl.scrollTop);
    };
}
