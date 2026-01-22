
export class LoadingOverlay {
    private element: HTMLElement;
    private textElement: HTMLElement;
    private progressFill: HTMLElement;

    constructor() {
        this.element = document.createElement('div');
        this.element.className = 'loading-overlay';
        this.element.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <div class="loading-text">Processing...</div>
                <div class="loading-progress-bar">
                    <div class="loading-progress-fill"></div>
                </div>
            </div>
        `;

        this.textElement = this.element.querySelector('.loading-text') as HTMLElement;
        this.progressFill = this.element.querySelector('.loading-progress-fill') as HTMLElement;

        document.body.appendChild(this.element);
    }

    show(message: string = 'Processing...', onCancel?: () => void) {
        this.textElement.textContent = message;
        this.setProgress(0);
        this.element.classList.add('visible');

        const existingBtn = this.element.querySelector('#loading-cancel-btn');
        if (existingBtn) existingBtn.remove();

        if (onCancel) {
            const btn = document.createElement('button');
            btn.id = 'loading-cancel-btn';
            btn.className = 'btn btn-secondary';
            btn.textContent = 'Cancel';
            btn.style.marginTop = '20px';
            btn.onclick = () => {
                onCancel();
                this.hide();
            };

            const content = this.element.querySelector('.loading-content');
            if (content) content.appendChild(btn);
        }
    }

    hide() {
        this.element.classList.remove('visible');
    }

    setProgress(percent: number) {
        this.progressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    }

    setText(text: string) {
        this.textElement.textContent = text;
    }
}
