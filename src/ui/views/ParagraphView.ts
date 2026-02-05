import type { Token } from '@spec/types';
import type { ReaderView } from './ViewInterface';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface AnnotationRange {
    id: string;
    type: 'highlight' | 'note';
    startOffset: number;
    endOffset: number;
    text?: string;
}

export class ParagraphView implements ReaderView {
    private container: HTMLElement | null = null;
    private contentEl: HTMLElement | null = null;
    private tokenEls: Map<number, HTMLElement> = new Map();
    private activeTokenIndex: number = -1;
    private onScroll: ((scrollTop: number) => void) | null = null;
    private annotations: AnnotationRange[] = [];
    private onAnnotationSelect: ((id: string) => void) | null = null;
    private notesPanelEl: HTMLElement | null = null;
    private notesListEl: HTMLElement | null = null;
    private notesToggleEl: HTMLButtonElement | null = null;
    private notesOpen: boolean = true;
    private lastTokens: Token[] = [];

    // New context
    private originalText: string = '';
    private contentType: 'text' | 'html' | 'markdown' = 'text';

    mount(container: HTMLElement): void {
        this.container = container;
        this.container.innerHTML = `
            <div class="paragraph-layout">
                <div class="paragraph-container" id="paragraph-content">
                    <!-- Content injected here -->
                </div>
                <aside class="notes-panel" id="notes-panel">
                    <div class="notes-panel-header">
                        <h3>Notes</h3>
                        <button class="btn btn-secondary btn-sm" id="notes-toggle">Hide</button>
                    </div>
                    <div class="notes-panel-list" id="notes-panel-list"></div>
                </aside>
            </div>
        `;
        this.contentEl = this.container.querySelector('#paragraph-content');
        this.notesPanelEl = this.container.querySelector('#notes-panel');
        this.notesListEl = this.container.querySelector('#notes-panel-list');
        this.notesToggleEl = this.container.querySelector('#notes-toggle');

        this.notesToggleEl?.addEventListener('click', () => {
            this.notesOpen = !this.notesOpen;
            this.updateNotesPanel();
        });
        if (this.contentEl) {
            this.contentEl.addEventListener('scroll', this.handleScroll);
        }
        this.updateNotesPanel();
    }

    unmount(): void {
        if (this.container) {
            if (this.contentEl) {
                this.contentEl.removeEventListener('scroll', this.handleScroll);
            }
            this.container.innerHTML = '';
            this.container = null;
            this.contentEl = null;
            this.tokenEls.clear();
        }
    }

    setDocumentContext(originalText: string, contentType: 'text' | 'html' | 'markdown') {
        this.originalText = originalText;
        this.contentType = contentType;
        // Reset rendered state so next update/render triggers full render
        if (this.contentEl) this.contentEl.innerHTML = '';
        this.tokenEls.clear();
    }

    /**
     * Re-renders the text based on content type.
     */
    renderText(tokens: Token[]) {
        if (!this.contentEl) return;

        this.contentEl.innerHTML = '';
        this.tokenEls.clear();
        this.lastTokens = tokens;

        if (this.contentType === 'html') {
            const clean = DOMPurify.sanitize(this.originalText);
            this.contentEl.innerHTML = this.stripExternalImages(clean);
            // TODO: implement highlighting for HTML if possible
            this.applyAnnotationsToHtml();
            return;
        } else if (this.contentType === 'markdown') {
            const html = marked.parse(this.originalText);
            const clean = DOMPurify.sanitize(html as string);
            this.contentEl.innerHTML = this.stripExternalImages(clean);
            this.applyAnnotationsToHtml();
            return;
        }

        // Default: Plain Text (Tokenized)
        const fragment = document.createDocumentFragment();

        tokens.forEach((token, index) => {
            const span = document.createElement('span');
            span.textContent = token.text;
            span.className = 'token';
            span.dataset.index = String(index);

            if (token.type === 'newline') {
                fragment.appendChild(document.createElement('br'));
                fragment.appendChild(document.createElement('br'));
                return;
            }

            this.tokenEls.set(index, span);
            fragment.appendChild(span);
        });

        this.contentEl.appendChild(fragment);
        this.applyAnnotationsToText(tokens);
    }

    update(tokenIndex: number, tokens: Token[]): void {
        if (!this.contentEl) return;

        // If content is empty (and we have something to show), render.
        // For HTML/MD, we look at originalText. For Text, we look at tokens.
        const shouldRender = this.contentEl.children.length === 0;

        if (shouldRender) {
            if (this.contentType !== 'text' && this.originalText) {
                this.renderText(tokens);
            } else if (tokens.length > 0) {
                this.renderText(tokens);
            }
        }

        // Highlighting logic - only for TEXT mode for now
        if (this.contentType === 'text') {
            if (this.activeTokenIndex !== -1) {
                const prevEl = this.tokenEls.get(this.activeTokenIndex);
                if (prevEl) prevEl.classList.remove('active');
            }

            this.activeTokenIndex = tokenIndex;
            const currEl = this.tokenEls.get(tokenIndex);

            if (currEl) {
                currEl.classList.add('active');

                // Auto-scroll logic
                currEl.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        }
    }

    getScrollTop(): number {
        if (!this.contentEl) return 0;
        return this.contentEl.scrollTop;
    }

    setScrollTop(value: number) {
        if (!this.contentEl) return;
        this.contentEl.scrollTop = value;
    }

    setTheme(_theme: string): void {
        // Theme logic
    }

    setAnnotations(annotations: AnnotationRange[], onSelect: ((id: string) => void) | null) {
        this.annotations = annotations;
        this.onAnnotationSelect = onSelect;
        this.updateNotesPanel();

        if (this.contentType === 'text') {
            this.applyAnnotationsToText(this.lastTokens);
        } else {
            this.applyAnnotationsToHtml();
        }
    }

    setScrollHandler(handler: ((scrollTop: number) => void) | null) {
        this.onScroll = handler;
    }

    private stripExternalImages(html: string): string {
        const template = document.createElement('template');
        template.innerHTML = html;

        const images = template.content.querySelectorAll('img');
        images.forEach(img => {
            const src = img.getAttribute('src') || '';
            if (!src) return;
            if (this.isExternalImageUrl(src)) img.remove();
        });

        return template.innerHTML;
    }

    private isExternalImageUrl(src: string): boolean {
        try {
            const url = new URL(src, window.location.origin);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
            return url.origin !== window.location.origin;
        } catch {
            return false;
        }
    }

    private applyAnnotationsToText(tokens: Token[]) {
        if (!this.contentEl || !tokens.length) return;

        for (const [index, el] of this.tokenEls) {
            el.classList.remove('highlight-span', 'note-span');
            const token = tokens[index];
            if (!token) continue;
            if (!this.annotations.length) continue;
            for (const annotation of this.annotations) {
                if (token.startOffset < annotation.endOffset && token.endOffset > annotation.startOffset) {
                    el.classList.add(annotation.type === 'note' ? 'note-span' : 'highlight-span');
                }
            }
        }
    }

    private applyAnnotationsToHtml() {
        if (!this.contentEl) return;
        this.unwrapHighlights();
        if (!this.annotations.length) return;

        const textNodes: { node: Text; start: number; end: number }[] = [];
        let offset = 0;
        const walker = document.createTreeWalker(this.contentEl, NodeFilter.SHOW_TEXT);
        let currentNode: Text | null = walker.nextNode() as Text | null;
        while (currentNode) {
            const text = currentNode.nodeValue || '';
            if (text.length > 0) {
                textNodes.push({ node: currentNode, start: offset, end: offset + text.length });
                offset += text.length;
            }
            currentNode = walker.nextNode() as Text | null;
        }

        for (const nodeInfo of textNodes) {
            const overlaps = this.annotations.filter(range =>
                range.endOffset > nodeInfo.start && range.startOffset < nodeInfo.end
            );
            if (!overlaps.length) continue;

            const sorted = overlaps.sort((a, b) => a.startOffset - b.startOffset);
            const text = nodeInfo.node.nodeValue || '';
            let cursor = 0;
            const fragment = document.createDocumentFragment();

            for (const range of sorted) {
                const start = Math.max(0, range.startOffset - nodeInfo.start);
                const end = Math.min(text.length, range.endOffset - nodeInfo.start);
                if (start >= end || start < cursor) continue;
                const before = text.slice(cursor, start);
                if (before) fragment.appendChild(document.createTextNode(before));

                const span = document.createElement('span');
                span.className = range.type === 'note' ? 'note-span' : 'highlight-span';
                span.textContent = text.slice(start, end);
                fragment.appendChild(span);
                cursor = end;
            }

            if (cursor < text.length) {
                fragment.appendChild(document.createTextNode(text.slice(cursor)));
            }

            nodeInfo.node.parentNode?.replaceChild(fragment, nodeInfo.node);
        }
    }

    private unwrapHighlights() {
        if (!this.contentEl) return;
        const spans = this.contentEl.querySelectorAll('span.highlight-span, span.note-span');
        spans.forEach(span => {
            const parent = span.parentNode;
            if (!parent) return;
            parent.replaceChild(document.createTextNode(span.textContent || ''), span);
            parent.normalize();
        });
    }

    private updateNotesPanel() {
        if (!this.notesPanelEl || !this.notesListEl || !this.notesToggleEl) return;
        this.notesPanelEl.classList.toggle('notes-panel-hidden', !this.notesOpen);
        this.notesToggleEl.textContent = this.notesOpen ? 'Hide' : 'Show';
        if (!this.notesOpen) return;

        if (!this.annotations.length) {
            this.notesListEl.innerHTML = '<div class="notes-empty">No notes or highlights yet.</div>';
            return;
        }

        const items = this.annotations.map(annotation => {
            const label = annotation.type === 'note' ? 'Note' : 'Highlight';
            const snippet = annotation.text ? annotation.text : `Offset ${annotation.startOffset}`;
            return `
                <button class="notes-item" data-id="${annotation.id}">
                    <div class="notes-item-title">${label}</div>
                    <div class="notes-item-text">${snippet}</div>
                </button>
            `;
        }).join('');

        this.notesListEl.innerHTML = items;
        this.notesListEl.querySelectorAll('.notes-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = (btn as HTMLElement).dataset.id;
                if (id && this.onAnnotationSelect) this.onAnnotationSelect(id);
            });
        });
    }

    private handleScroll = () => {
        if (!this.contentEl || !this.onScroll) return;
        this.onScroll(this.contentEl.scrollTop);
    };
}
