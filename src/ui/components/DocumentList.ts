import { documentStore } from '../../storage/DocumentStore';
import type { DocumentEntity } from '../../storage/Database';

interface DocumentListCallbacks {
    onResume: (docId: string) => void;
    onDelete: (docId: string) => void;
    onNewDocument: () => void;
}

export class DocumentList {
    private container: HTMLElement;
    private callbacks: DocumentListCallbacks;

    constructor(container: HTMLElement, callbacks: DocumentListCallbacks) {
        this.container = container;
        this.callbacks = callbacks;
    }

    async mount() {
        const documents = await documentStore.getAllDocuments();
        this.render(documents);
    }

    private render(documents: DocumentEntity[]) {
        if (documents.length === 0) {
            this.container.innerHTML = `
                <div class="document-list-container">
                    <h2>Your Library</h2>
                    <div class="empty-state" style="text-align: center; padding: 60px 20px; color: #666;">
                        <p style="font-size: 1.2rem; margin-bottom: 20px;">No documents yet</p>
                        <button class="btn" id="btn-new-from-empty">Create Your First Document</button>
                    </div>
                </div>
            `;
            this.container.querySelector('#btn-new-from-empty')?.addEventListener('click', () => {
                this.callbacks.onNewDocument();
            });
            return;
        }

        const listItems = documents.map(doc => this.renderDocumentItem(doc)).join('');

        this.container.innerHTML = `
            <div class="document-list-container">
                <h2>Your Library</h2>
                <div class="document-list">
                    ${listItems}
                </div>
            </div>
        `;

        // Attach event listeners
        documents.forEach(doc => {
            const resumeBtn = this.container.querySelector(`#resume-${doc.id}`);
            const deleteBtn = this.container.querySelector(`#delete-${doc.id}`);

            resumeBtn?.addEventListener('click', () => this.callbacks.onResume(doc.id));
            deleteBtn?.addEventListener('click', () => this.confirmDelete(doc));
        });
    }

    private renderDocumentItem(doc: DocumentEntity): string {
        const lastRead = this.formatRelativeTime(doc.lastReadAt);
        const wordCount = doc.originalText.split(/\s+/).length;
        const progress = doc.progressTokenIndex > 0
            ? Math.min(100, Math.round((doc.progressTokenIndex / wordCount) * 100))
            : 0;

        return `
            <div class="document-item" data-id="${doc.id}">
                <div class="document-info">
                    <h3 class="document-title">${this.escapeHtml(doc.title)}</h3>
                    <div class="document-meta">
                        <span>${wordCount.toLocaleString()} words</span>
                        <span>•</span>
                        <span>Last read ${lastRead}</span>
                        ${progress > 0 ? `<span>•</span><span>${progress}% complete</span>` : ''}
                    </div>
                    ${progress > 0 ? `
                        <div class="progress-bar-container">
                            <div class="progress-bar" style="width: ${progress}%"></div>
                        </div>
                    ` : ''}
                </div>
                <div class="document-actions">
                    <button class="btn btn-primary" id="resume-${doc.id}">
                        ${progress > 0 ? 'Resume' : 'Start'}
                    </button>
                    <button class="btn btn-danger" id="delete-${doc.id}">Delete</button>
                </div>
            </div>
        `;
    }

    private confirmDelete(doc: DocumentEntity) {
        if (confirm(`Delete "${doc.title}"? This cannot be undone.`)) {
            documentStore.deleteDocument(doc.id).then(() => {
                this.mount(); // Refresh list
            });
            this.callbacks.onDelete(doc.id);
        }
    }

    private formatRelativeTime(timestamp: number): string {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return new Date(timestamp).toLocaleDateString();
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    unmount() {
        this.container.innerHTML = '';
    }
}
