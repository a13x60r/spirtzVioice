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
                            <h3>👋 Welcome</h3>
                            <p class="info-text">
                                Spirtz Voice helps you read faster and listen to your documents at the same time. it's 100% offline and private.
                            </p>
                        </section>

                        <section class="settings-group">
                            <h3>📖 Reading Modes</h3>
                            <div class="info-item">
                                <strong>Speed Reader (RSVP):</strong>
                                <p class="info-text">Shows one word at a time in the center. Stops your eyes from moving, letting you read much faster.</p>
                            </div>
                            <div class="info-item">
                                <strong>Paragraph View:</strong>
                                <p class="info-text">Traditional layout. Highlights words as they are spoken. Great for comprehension.</p>
                            </div>
                            <div class="info-item">
                                <strong>Focus View:</strong>
                                <p class="info-text">Distraction-free mode. Shuts out everything but the text.</p>
                            </div>
                        </section>

                        <section class="settings-group">
                            <h3>⚡ Speed & Settings</h3>
                            <div class="info-item">
                                <strong>WPM (Words Per Minute):</strong>
                                <p class="info-text">Controls how fast you read. Faster WPM = faster voice and faster flashing words. 250 WPM is a normal reading speed.</p>
                            </div>
                        </section>

                        <section class="settings-group">
                            <h3>⌨️ Shortcuts</h3>
                            <div class="shortcut-list">
                                <div class="help-row"><span class="help-key">Space</span><span class="help-desc">Play / Pause</span></div>
                                <div class="help-row"><span class="help-key">Left / Right</span><span class="help-desc">Prev / Next Chunk</span></div>
                                <div class="help-row"><span class="help-key">Shift + Left / Right</span><span class="help-desc">Prev / Next Sentence</span></div>
                                <div class="help-row"><span class="help-key">+ / -</span><span class="help-desc">Increase / Decrease Speed</span></div>
                                <div class="help-row"><span class="help-key">Esc</span><span class="help-desc">Paging / Exit Focus</span></div>
                                <div class="help-row"><span class="help-key">?</span><span class="help-desc">Keyboard Help</span></div>
                            </div>
                        </section>

                        <section class="settings-group">
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                <h3>✂️ Web Clipper</h3>
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
                                <strong>How to use:</strong> Select text on any webpage and click the "Clip to Spirtz" bookmark to transfer it here.
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
