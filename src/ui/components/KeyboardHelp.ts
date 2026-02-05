import { ICONS } from '../icons';

export class KeyboardHelp {
    private container: HTMLElement;
    private onClose: () => void;

    constructor(container: HTMLElement, onClose: () => void) {
        this.container = container;
        this.onClose = onClose;
        this.render();
        this.setVisible(false);
    }

    private render() {
        this.container.innerHTML = `
            <div class="help-modal-overlay">
                <div class="help-modal">
                    <header class="help-header">
                        <h2>Keyboard Shortcuts</h2>
                        <button class="btn btn-secondary btn-icon" id="close-help" title="Close" aria-label="Close">${ICONS.close}</button>
                    </header>
                    <div class="help-content">
                        <div class="help-row"><span class="help-key">?</span><span class="help-desc">Toggle this help</span></div>
                        <div class="help-row"><span class="help-key">Space</span><span class="help-desc">Play / Pause</span></div>
                        <div class="help-row"><span class="help-key">Left</span><span class="help-desc">Previous chunk</span></div>
                        <div class="help-row"><span class="help-key">Right</span><span class="help-desc">Next chunk</span></div>
                        <div class="help-row"><span class="help-key">Shift + Left</span><span class="help-desc">Previous sentence</span></div>
                        <div class="help-row"><span class="help-key">Shift + Right</span><span class="help-desc">Next sentence</span></div>
                        <div class="help-row"><span class="help-key">+</span><span class="help-desc">Increase speed</span></div>
                        <div class="help-row"><span class="help-key">-</span><span class="help-desc">Decrease speed</span></div>
                        <div class="help-row"><span class="help-key">Esc</span><span class="help-desc">Open paging view</span></div>
                    </div>
                </div>
            </div>
        `;

        const closeBtn = this.container.querySelector('#close-help') as HTMLButtonElement | null;
        closeBtn?.addEventListener('click', () => this.onClose());

        const overlay = this.container.querySelector('.help-modal-overlay') as HTMLElement | null;
        overlay?.addEventListener('click', (event) => {
            const target = event.target as HTMLElement | null;
            if (target?.classList.contains('help-modal-overlay')) {
                this.onClose();
            }
        });
    }

    setVisible(visible: boolean) {
        this.container.classList.toggle('help-hidden', !visible);
    }

    unmount() {
        this.container.innerHTML = '';
    }
}
