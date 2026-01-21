export class TextInput {
    private container: HTMLElement;
    private onSubmit: (title: string, originalText: string, ttsText: string) => void;

    constructor(container: HTMLElement, onSubmit: (title: string, originalText: string, ttsText: string) => void) {
        this.container = container;
        this.onSubmit = onSubmit;
    }

    mount() {
        this.container.innerHTML = `
            <div class="text-input-container">
                <h2>New Document</h2>
                <div class="file-upload-zone" id="drop-zone" style="border: 2px dashed #ccc; padding: 20px; text-align: center; margin-bottom: 20px; border-radius: 8px; cursor: pointer;">
                    <p>Drag & drop files here or <strong>click to upload</strong></p>
                    <input type="file" id="file-input" accept=".txt,.md,.html" style="display: none;">
                    <small style="color: #666;">Supports .txt, .md, .html</small>
                </div>
                <input type="text" id="doc-title" class="input" placeholder="Document Title" style="margin-bottom: 10px;">
                <textarea id="doc-text" class="input" rows="10" placeholder="Paste text here..."></textarea>
                <div class="actions" style="margin-top: 20px; display: flex; justify-content: flex-end;">
                    <button class="btn" id="start-reading">Start Reading</button>
                </div>
            </div>
        `;

        const dropZone = this.container.querySelector('#drop-zone') as HTMLElement;
        const fileInput = this.container.querySelector('#file-input') as HTMLInputElement;
        const titleInput = this.container.querySelector('#doc-title') as HTMLInputElement;
        const textTextArea = this.container.querySelector('#doc-text') as HTMLTextAreaElement;

        dropZone?.addEventListener('click', () => fileInput.click());

        dropZone?.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '#007aff';
            dropZone.style.backgroundColor = 'rgba(0, 122, 255, 0.05)';
        });

        dropZone?.addEventListener('dragleave', () => {
            dropZone.style.borderColor = '#ccc';
            dropZone.style.backgroundColor = 'transparent';
        });

        dropZone?.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '#ccc';
            dropZone.style.backgroundColor = 'transparent';
            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                this.handleFile(files[0]);
            }
        });

        fileInput?.addEventListener('change', (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files && files.length > 0) {
                this.handleFile(files[0]);
            }
        });

        this.container.querySelector('#start-reading')?.addEventListener('click', () => {
            const title = titleInput.value;
            const text = textTextArea.value;
            if (title && text) {
                // Check if we have stored original content from file import
                const originalContent = (textTextArea as any)._originalContent || text;
                const ttsContent = (textTextArea as any)._ttsContent || text;
                this.onSubmit(title, originalContent, ttsContent);
            }
        });
    }

    private async handleFile(file: File) {
        const titleInput = this.container.querySelector('#doc-title') as HTMLInputElement;
        const textTextArea = this.container.querySelector('#doc-text') as HTMLTextAreaElement;

        if (!titleInput.value) {
            // Set title from filename without extension
            titleInput.value = file.name.replace(/\.[^/.]+$/, "");
        }

        try {
            const content = await file.text();
            let ttsText: string;

            if (file.name.endsWith('.html')) {
                const { extractTextFromHtml } = await import('../utils/htmlUtils');
                ttsText = extractTextFromHtml(content);
            } else if (file.name.endsWith('.md')) {
                const { stripMarkdown } = await import('../utils/markdownUtils');
                ttsText = stripMarkdown(content);
            } else {
                // Plain text
                ttsText = content;
            }

            // Display raw content in textarea for user to see/edit
            textTextArea.value = content;
            // Store both: original (raw) and TTS-ready versions
            (textTextArea as any)._originalContent = content;
            (textTextArea as any)._ttsContent = ttsText;
        } catch (error) {
            console.error('Error reading file:', error);
            alert('Failed to read file.');
        }
    }

    unmount() {
        this.container.innerHTML = '';
    }
}
