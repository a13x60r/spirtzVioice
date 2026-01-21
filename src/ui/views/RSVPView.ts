import type { Token } from '@spec/types';
import type { ReaderView } from './ViewInterface';

export class RSVPView implements ReaderView {
    private container: HTMLElement | null = null;
    private wordEl: HTMLElement | null = null;
    private currentTokenIndex: number = -1;

    mount(container: HTMLElement): void {
        this.container = container;
        this.container.innerHTML = `
            <div class="rsvp-container">
                <div class="rsvp-word" id="rsvp-word">Ready</div>
                <div class="rsvp-guides">
                    <div class="rsvp-guide-top"></div>
                    <div class="rsvp-guide-bottom"></div>
                </div>
            </div>
        `;
        this.wordEl = this.container.querySelector('#rsvp-word');
    }

    unmount(): void {
        if (this.container) {
            this.container.innerHTML = '';
            this.container = null;
            this.wordEl = null;
        }
    }

    update(tokenIndex: number, tokens: Token[]): void {
        if (!this.wordEl || !tokens || tokens.length === 0) return;

        // Optimize: verify index changes
        if (this.currentTokenIndex === tokenIndex) return;
        this.currentTokenIndex = tokenIndex;

        const token = tokens[tokenIndex];
        if (token) {
            // Highlight the "pivot" point (approx middle)
            // For MVP simpler logic: just show the word
            this.wordEl.textContent = token.text;

            // Visual cue for punctuation?
            if (token.type === 'punct') {
                this.wordEl.style.color = 'var(--color-text-secondary)';
            } else {
                this.wordEl.style.color = 'var(--color-text)';
            }
        }
    }

    setTheme(_theme: string): void {
        // Handle theme changes if necessary
    }
}
