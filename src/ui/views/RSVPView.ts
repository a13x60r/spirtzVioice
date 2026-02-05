import type { Token } from '@spec/types';
import type { ReaderView } from './ViewInterface';
import { getOrpLettersOnly, splitForHighlight } from '../../utils/orp';

export class RSVPView implements ReaderView {
    private container: HTMLElement | null = null;
    private wordContainer: HTMLElement | null = null;
    private prefixEl: HTMLElement | null = null;
    private orpEl: HTMLElement | null = null;
    private suffixEl: HTMLElement | null = null;

    private currentTokenIndex: number = -1;

    mount(container: HTMLElement): void {
        this.container = container;
        this.container.innerHTML = `
            <div class="rsvp-container">
                <div class="rsvp-word-layout" id="rsvp-word-layout">
                    <div class="rsvp-prefix"></div>
                    <div class="rsvp-orp"></div>
                    <div class="rsvp-suffix"></div>
                </div>
                <div class="rsvp-guides">
                    <div class="rsvp-guide-top"></div>
                    <div class="rsvp-guide-bottom"></div>
                </div>
            </div>
        `;

        this.wordContainer = this.container.querySelector('#rsvp-word-layout');
        this.prefixEl = this.container.querySelector('.rsvp-prefix');
        this.orpEl = this.container.querySelector('.rsvp-orp');
        this.suffixEl = this.container.querySelector('.rsvp-suffix');
    }

    unmount(): void {
        if (this.container) {
            this.container.innerHTML = '';
            this.container = null;
            this.wordContainer = null;
            this.prefixEl = null;
            this.orpEl = null;
            this.suffixEl = null;
            this.currentTokenIndex = -1;
        }
    }

    update(tokenIndex: number, tokens: Token[]): void {
        if (!this.wordContainer || !this.prefixEl || !this.orpEl || !this.suffixEl || !tokens || tokens.length === 0) return;

        // Optimize: verify index changes
        if (this.currentTokenIndex === tokenIndex) return;
        this.currentTokenIndex = tokenIndex;

        const token = tokens[tokenIndex];
        if (token) {
            const word = token.text;

            // Calculate ORP
            const orpResult = getOrpLettersOnly(word);
            const [prefix, mid, suffix] = splitForHighlight(word, orpResult.orpIndex);

            // Update DOM
            this.prefixEl.textContent = prefix;
            this.orpEl.textContent = mid;
            this.suffixEl.textContent = suffix;

            // Visual cue for punctuation? (kept from previous code, though color is now managed by CSS classes mostly)
            if (token.type === 'punct') {
                this.wordContainer.classList.add('rsvp-punct');
            } else {
                this.wordContainer.classList.remove('rsvp-punct');
            }
        }
    }

    setTheme(_theme: string): void {
        // Handle theme changes if necessary
    }
}
