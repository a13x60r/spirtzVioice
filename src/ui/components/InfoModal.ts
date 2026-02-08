import { generateBookmarkletCode } from '../../utils/bookmarklet';
import { ICONS } from '../icons';

export class InfoModal {
    private container: HTMLElement;
    private onClose: () => void;

    constructor(
        container: HTMLElement,
        onClose: () => void
    ) {
        this.container = container;
        this.onClose = onClose;
    }

    public mount() {
        const currentUrl = window.location.origin + window.location.pathname;
        const bookmarkletCode = generateBookmarkletCode(currentUrl);

        this.container.innerHTML = `
            <div class="settings-modal-overlay">
                <div class="settings-modal">
                    <header class="settings-header">
                        <h2>Info & Help</h2>
                        <button class="btn btn-secondary btn-icon" id="close-info" title="Close" aria-label="Close">
                            ${ICONS.close}
                        </button>
                    </header>

                    <div class="settings-content">
                        <section class="settings-group">
                            <h3>About Spirtz Voice</h3>
                            <p class="info-text">
                                Spirtz Voice is a high-performance, offline-first reading application that synchronizes text with speech.
                            </p>
                            <p class="info-text" style="font-size: 0.85rem; margin-top: 0.5rem; color: var(--color-text-secondary);">
                                It combines <strong>RSVP (Rapid Serial Visual Presentation)</strong> with exact audio alignment to help you read faster while maintaining focus. All processing and speech synthesis happen locally on your device for maximum privacy and speed.
                            </p>
                        </section>

                        <section class="settings-group">
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                <h3>Web Clipper</h3>
                                <span class="info-badge" title="Bookmarket to clip text from other websites to Spirtz Voice.">i</span>
                            </div>
                            <p class="info-text" style="margin-bottom: 1rem;">
                                Drag this button to your bookmarks bar to clip text from any website:
                            </p>
                            <div style="text-align: center; margin-bottom: 1rem;">
                                <a href="${bookmarkletCode}" class="btn btn-primary" style="text-decoration: none; cursor: grab;" onclick="return false;">
                                    Clip to Spirtz
                                </a>
                            </div>
                            <p class="info-text" style="font-size: 0.8rem; color: var(--color-text-secondary);">
                                <strong>How to use:</strong><br>
                                1. Drag the button above to your browser's bookmarks bar.<br>
                                2. Navigate to any article on the web.<br>
                                3. Select the text you want to read (or select nothing to clip the whole page).<br>
                                4. Click the "Clip to Spirtz" bookmark.<br>
                            </p>
                        </section>
                        
                        <section class="settings-group">
                            <h3>Shortcuts</h3>
                             <p class="info-text">
                                <strong>Space:</strong> Play/Pause<br>
                                <strong>Left/Right:</strong> Navigation<br>
                                <strong>Escape:</strong> Switch View / Close
                            </p>
                        </section>
                    </div>
                </div>
            </div>
        `;

        // Event listeners
        this.container.querySelector('.settings-modal-overlay')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.unmount();
            }
        });

        this.container.querySelector('#close-info')?.addEventListener('click', () => {
            this.unmount();
        });
    }

    public unmount() {
        this.container.innerHTML = '';
        this.onClose();
    }
}
