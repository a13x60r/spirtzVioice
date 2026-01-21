export class TextInput {
    private container: HTMLElement;
    private onSubmit: (title: string, text: string) => void;

    constructor(container: HTMLElement, onSubmit: (title: string, text: string) => void) {
        this.container = container;
        this.onSubmit = onSubmit;
    }

    mount() {
        this.container.innerHTML = `
            <div class="text-input-container">
                <h2>New Document</h2>
                <input type="text" id="doc-title" class="input" placeholder="Document Title" style="margin-bottom: 10px;">
                <textarea id="doc-text" class="input" rows="10" placeholder="Paste text here..."></textarea>
                <div class="actions" style="margin-top: 20px; display: flex; justify-content: flex-end;">
                    <button class="btn" id="start-reading">Start Reading</button>
                </div>
            </div>
        `;

        this.container.querySelector('#start-reading')?.addEventListener('click', () => {
            const title = (this.container.querySelector('#doc-title') as HTMLInputElement).value;
            const text = (this.container.querySelector('#doc-text') as HTMLTextAreaElement).value;
            if (title && text) {
                this.onSubmit(title, text);
            }
        });
    }

    unmount() {
        this.container.innerHTML = '';
    }
}
