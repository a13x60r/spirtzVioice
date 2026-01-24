
export class TextInput {
    private container: HTMLElement;
    private onSubmit: (docs: { title: string, originalText: string, ttsText: string, contentType: 'text' | 'html' | 'markdown', language?: string }[]) => void;

    constructor(container: HTMLElement, onSubmit: (docs: { title: string, originalText: string, ttsText: string, contentType: 'text' | 'html' | 'markdown', language?: string }[]) => void) {
        this.container = container;
        this.onSubmit = onSubmit;
    }

    mount() {
        this.container.innerHTML = `
            <div class="text-input-container">
                <h2>New Document</h2>
                <div class="file-upload-zone" id="drop-zone" style="border: 2px dashed #ccc; padding: 20px; text-align: center; margin-bottom: 20px; border-radius: 8px; cursor: pointer;">
                    <p>Drag & drop files here or <strong>click to upload</strong></p>
                    <input type="file" id="file-input" accept=".txt,.md,.html" multiple style="display: none;">
                    <small style="color: #666;">Supports .txt, .md, .html (Multiple allowed)</small>
                </div>
                <div id="file-list-preview" style="display: none; margin-bottom: 20px; background: var(--color-bg-secondary); padding: 10px; border-radius: 8px;">
                    <h4 style="margin-bottom: 5px;">Selected Files:</h4>
                    <ul id="selected-files-list" style="max-height: 150px; overflow-y: auto; font-size: 0.9rem; padding-left: 20px;"></ul>
                </div>
                <div id="manual-entry-form">
                    <input type="text" id="doc-title" class="input" placeholder="Document Title" style="margin-bottom: 10px;">
                    <textarea id="doc-text" class="input" rows="10" placeholder="Paste text here..."></textarea>
                </div>
                <div class="actions" style="margin-top: 20px; display: flex; justify-content: flex-end;">
                    <button class="btn" id="start-reading">Start Reading</button>
                    <button class="btn" id="bulk-import" style="display: none;">Import All Files</button>
                </div>
            </div>
        `;

        const dropZone = this.container.querySelector('#drop-zone') as HTMLElement;
        const fileInput = this.container.querySelector('#file-input') as HTMLInputElement;
        const titleInput = this.container.querySelector('#doc-title') as HTMLInputElement;
        const textTextArea = this.container.querySelector('#doc-text') as HTMLTextAreaElement;
        const bulkBtn = this.container.querySelector('#bulk-import') as HTMLButtonElement;
        const startBtn = this.container.querySelector('#start-reading') as HTMLButtonElement;

        dropZone?.addEventListener('click', () => fileInput.click());

        dropZone?.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--color-primary)';
            dropZone.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
        });

        dropZone?.addEventListener('dragleave', () => {
            dropZone.style.borderColor = '#ccc';
            dropZone.style.backgroundColor = 'transparent';
        });

        dropZone?.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '#ccc';
            dropZone.style.backgroundColor = 'transparent';
            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                await this.handleFiles(files);
            }
        });

        fileInput?.addEventListener('change', async (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files && files.length > 0) {
                await this.handleFiles(files);
            }
        });

        startBtn?.addEventListener('click', async () => {
            const title = titleInput.value;
            const text = textTextArea.value;
            if (title && text) {
                const originalContent = (textTextArea as any)._originalContent || text;
                const ttsContent = (textTextArea as any)._ttsContent || text;
                const contentType = (textTextArea as any)._contentType || 'text';

                let language = (textTextArea as any)._language;
                if (!language) {
                    const { detectLanguage } = await import('../utils/languageUtils');
                    language = detectLanguage(ttsContent);
                }

                this.onSubmit([{ title, originalText: originalContent, ttsText: ttsContent, contentType, language }]);
            }
        });

        bulkBtn?.addEventListener('click', () => {
            const pending = (this as any)._pendingFiles as any[];
            if (pending && pending.length > 0) {
                this.onSubmit(pending);
            }
        });
    }

    private async handleFiles(files: FileList) {
        if (files.length === 1) {
            await this.handleSingleFile(files[0]);
            return;
        }

        const manualForm = this.container.querySelector('#manual-entry-form') as HTMLElement;
        const previewZone = this.container.querySelector('#file-list-preview') as HTMLElement;
        const fileListUl = this.container.querySelector('#selected-files-list') as HTMLElement;
        const bulkBtn = this.container.querySelector('#bulk-import') as HTMLButtonElement;
        const startBtn = this.container.querySelector('#start-reading') as HTMLButtonElement;

        if (manualForm) manualForm.style.display = 'none';
        if (previewZone) previewZone.style.display = 'block';
        if (bulkBtn) bulkBtn.style.display = 'block';
        if (startBtn) startBtn.style.display = 'none';

        if (fileListUl) fileListUl.innerHTML = '';
        const pendingDocs: any[] = [];

        for (const file of Array.from(files)) {
            const li = document.createElement('li');
            li.textContent = `Loading ${file.name}...`;
            if (fileListUl) fileListUl.appendChild(li);

            try {
                const doc = await this.processFile(file);
                pendingDocs.push(doc);
                li.textContent = `✅ ${file.name}`;
            } catch (e) {
                li.textContent = `❌ ${file.name} (Error)`;
                console.error(e);
            }
        }

        (this as any)._pendingFiles = pendingDocs;
        if (bulkBtn) bulkBtn.textContent = `Import ${pendingDocs.length} Files`;
    }

    private async handleSingleFile(file: File) {
        const titleInput = this.container.querySelector('#doc-title') as HTMLInputElement;
        const textTextArea = this.container.querySelector('#doc-text') as HTMLTextAreaElement;
        const manualForm = this.container.querySelector('#manual-entry-form') as HTMLElement;
        const previewZone = this.container.querySelector('#file-list-preview') as HTMLElement;
        const bulkBtn = this.container.querySelector('#bulk-import') as HTMLButtonElement;
        const startBtn = this.container.querySelector('#start-reading') as HTMLButtonElement;

        if (manualForm) manualForm.style.display = 'block';
        if (previewZone) previewZone.style.display = 'none';
        if (bulkBtn) bulkBtn.style.display = 'none';
        if (startBtn) startBtn.style.display = 'block';

        try {
            const doc = await this.processFile(file);
            if (titleInput) titleInput.value = doc.title;
            if (textTextArea) {
                textTextArea.value = doc.originalText;
                (textTextArea as any)._originalContent = doc.originalText;
                (textTextArea as any)._ttsContent = doc.ttsText;
                (textTextArea as any)._contentType = doc.contentType;
                (textTextArea as any)._language = doc.language;
            }
        } catch (error) {
            console.error('Error reading file:', error);
            alert('Failed to read file.');
        }
    }

    private async processFile(file: File) {
        const content = await file.text();
        let ttsText: string;
        let contentType: 'text' | 'html' | 'markdown' = 'text';

        if (file.name.endsWith('.html')) {
            const { extractTextFromHtml } = await import('../utils/htmlUtils');
            ttsText = extractTextFromHtml(content);
            contentType = 'html';
        } else if (file.name.endsWith('.md')) {
            const { stripMarkdown } = await import('../utils/markdownUtils');
            ttsText = stripMarkdown(content);
            contentType = 'markdown';
        } else {
            ttsText = content;
            contentType = 'text';
        }

        const { detectLanguage } = await import('../utils/languageUtils');
        const language = detectLanguage(ttsText);

        return {
            title: file.name.replace(/\.[^/.]+$/, ""),
            originalText: content,
            ttsText: ttsText,
            contentType,
            language
        };
    }

    unmount() {
        this.container.innerHTML = '';
    }
}
