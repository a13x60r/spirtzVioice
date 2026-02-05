import { documentStore } from '../../storage/DocumentStore';
import type { DocumentEntity } from '../../storage/Database';

const LIBRARY_ICONS = {
    play: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 7h12l-1 14H7L6 7zm3-3h6l1 2H8l1-2z"/></svg>`
};

interface DocumentListCallbacks {
    onResume: (docId: string) => void;
    onDelete: (docId: string) => void;
    onNewDocument: () => void;
}

export class DocumentList {
    private container: HTMLElement;
    private callbacks: DocumentListCallbacks;
    private selectedIds: Set<string> = new Set();
    private documents: DocumentEntity[] = [];
    private filterText: string = '';
    private sortBy: 'recent' | 'title' | 'progress' = 'recent';

    constructor(container: HTMLElement, callbacks: DocumentListCallbacks) {
        this.container = container;
        this.callbacks = callbacks;
    }

    async mount() {
        this.documents = await documentStore.getAllDocuments();
        this.selectedIds.clear();
        this.render();
    }

    private render() {
        if (this.documents.length === 0) {
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

        const filteredDocs = this.documents
            .filter(doc => doc.title.toLowerCase().includes(this.filterText.toLowerCase()))
            .sort((a, b) => {
                if (this.sortBy === 'title') {
                    return a.title.localeCompare(b.title);
                } else if (this.sortBy === 'progress') {
                    const progressA = a.progressTokenIndex / (a.originalText.length || 1); // rough approx or need word count
                    const progressB = b.progressTokenIndex / (b.originalText.length || 1);
                    return progressB - progressA; // Descending progress
                } else {
                    return b.lastReadAt - a.lastReadAt; // Default recent
                }
            });

        const listItems = filteredDocs.map(doc => this.renderDocumentItem(doc)).join('');
        const allSelected = filteredDocs.length > 0 && filteredDocs.every(doc => this.selectedIds.has(doc.id));
        const anySelected = this.selectedIds.size > 0;

        this.container.innerHTML = `
            <div class="document-list-container">
                <div class="library-header">
                    <h2>Your Library</h2>
                    <div class="library-controls">
                        <div class="search-box">
                            <input type="text" id="doc-search" class="input" placeholder="Search documents..." value="${this.escapeHtml(this.filterText)}">
                        </div>
                        <div class="sort-controls">
                            <select id="doc-sort" class="input">
                                <option value="recent" ${this.sortBy === 'recent' ? 'selected' : ''}>Recent</option>
                                <option value="title" ${this.sortBy === 'title' ? 'selected' : ''}>Title (A-Z)</option>
                                <option value="progress" ${this.sortBy === 'progress' ? 'selected' : ''}>Progress</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div class="bulk-actions-bar ${anySelected ? 'visible' : ''}">
                    <label class="select-all-label">
                        <input type="checkbox" id="select-all" ${allSelected ? 'checked' : ''}>
                        <span>Select All ${this.filterText ? '(Filtered)' : ''}</span>
                    </label>
                    <button class="btn btn-danger btn-sm btn-icon" id="btn-delete-selected" data-count="${this.selectedIds.size}" title="Delete Selected (${this.selectedIds.size})" aria-label="Delete Selected (${this.selectedIds.size})" ${!anySelected ? 'disabled' : ''}>
                        ${LIBRARY_ICONS.trash}
                    </button>
                </div>

                <div class="document-list-scroll-area">
                    <div class="document-list">
                        ${listItems}
                        ${filteredDocs.length === 0 ? '<div class="no-results">No documents match your search</div>' : ''}
                    </div>
                </div>
            </div>
        `;

        // Attach event listeners
        this.container.querySelector('#doc-search')?.addEventListener('input', (e) => {
            this.filterText = (e.target as HTMLInputElement).value;
            this.render();
            // Maintain focus
            const input = this.container.querySelector('#doc-search') as HTMLInputElement;
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        });

        this.container.querySelector('#doc-sort')?.addEventListener('change', (e) => {
            this.sortBy = (e.target as HTMLSelectElement).value as any;
            this.render();
        });

        this.container.querySelector('#select-all')?.addEventListener('change', (e) => {
            const checked = (e.target as HTMLInputElement).checked;
            if (checked) {
                // Select all visible (filtered) docs
                filteredDocs.forEach(doc => this.selectedIds.add(doc.id));
            } else {
                // Deselect all visible docs
                filteredDocs.forEach(doc => this.selectedIds.delete(doc.id));
            }
            this.render();
        });

        this.container.querySelector('#btn-delete-selected')?.addEventListener('click', () => {
            this.confirmBulkDelete();
        });

        this.documents.forEach(doc => {
            const resumeBtn = this.container.querySelector(`#resume-${doc.id}`);
            const deleteBtn = this.container.querySelector(`#delete-${doc.id}`);
            const checkbox = this.container.querySelector(`#select-${doc.id}`) as HTMLInputElement;

            resumeBtn?.addEventListener('click', () => this.callbacks.onResume(doc.id));
            deleteBtn?.addEventListener('click', () => this.confirmDelete(doc));
            checkbox?.addEventListener('change', () => {
                if (checkbox.checked) {
                    this.selectedIds.add(doc.id);
                } else {
                    this.selectedIds.delete(doc.id);
                }
                this.render();
            });
        });
    }

    private renderDocumentItem(doc: DocumentEntity): string {
        const lastRead = this.formatRelativeTime(doc.lastReadAt);
        const wordCount = doc.totalTokens || doc.originalText.split(/\s+/).length;
        const progress = doc.progressTokenIndex > 0
            ? Math.min(100, Math.round((doc.progressTokenIndex / wordCount) * 100))
            : 0;
        const isSelected = this.selectedIds.has(doc.id);
        const language = doc.language || '';
        const flag = this.getLanguageFlag(language);
        const languageLabel = this.getLanguageLabel(language);

        return `
            <div class="document-item ${isSelected ? 'selected' : ''}" data-id="${doc.id}">
                <div class="document-selection">
                    <input type="checkbox" id="select-${doc.id}" ${isSelected ? 'checked' : ''}>
                </div>
                <div class="document-info">
                    <h3 class="document-title">
                        <span class="language-flag" title="${languageLabel}">${flag}</span>
                        ${this.escapeHtml(doc.title)}
                    </h3>
                    <div class="document-meta">
                        <span>${wordCount.toLocaleString()} tokens</span>
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
                    <button class="btn btn-primary btn-sm btn-icon" id="resume-${doc.id}" title="${progress > 0 ? 'Resume' : 'Start'}" aria-label="${progress > 0 ? 'Resume' : 'Start'}">
                        ${LIBRARY_ICONS.play}
                    </button>
                    <button class="btn btn-danger btn-sm btn-icon" id="delete-${doc.id}" title="Delete" aria-label="Delete">
                        ${LIBRARY_ICONS.trash}
                    </button>
                </div>
            </div>
        `;
    }

    private getLanguageFlag(language: string): string {
        const base = language.split('-')[0].toLowerCase();
        switch (base) {
            case 'en':
                return '🇺🇸';
            case 'de':
                return '🇩🇪';
            case 'ru':
                return '🇷🇺';
            case 'es':
                return '🇪🇸';
            case 'fr':
                return '🇫🇷';
            default:
                return '🌐';
        }
    }

    private getLanguageLabel(language: string): string {
        if (!language) return 'Language not set';
        const base = language.split('-')[0].toLowerCase();
        switch (base) {
            case 'en':
                return 'English';
            case 'de':
                return 'German';
            case 'ru':
                return 'Russian';
            case 'es':
                return 'Spanish';
            case 'fr':
                return 'French';
            default:
                return language;
        }
    }

    private confirmDelete(doc: DocumentEntity) {
        if (confirm(`Delete "${doc.title}"? This cannot be undone.`)) {
            documentStore.bulkDeleteDocuments([doc.id]).then(() => {
                this.mount(); // Refresh list
            });
            this.callbacks.onDelete(doc.id);
        }
    }

    private confirmBulkDelete() {
        const count = this.selectedIds.size;
        if (confirm(`Delete ${count} selected document${count > 1 ? 's' : ''}? This cannot be undone.`)) {
            const ids = Array.from(this.selectedIds);
            documentStore.bulkDeleteDocuments(ids).then(() => {
                this.mount(); // Refresh list
            });
            // We might need to notify and handle the currently playing document if it was deleted
            ids.forEach(id => this.callbacks.onDelete(id));
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
