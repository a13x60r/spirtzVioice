import type { Token } from "@spec/types";
import DOMPurify from "dompurify";
import { marked } from "marked";
import type { ReaderView } from "./ViewInterface";

interface AnnotationRange {
	id: string;
	type: "highlight" | "note";
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
	private textNodeIndex: { node: Text; start: number; end: number }[] = [];
	private textNodeLength: number = 0;

	// New context
	private originalText: string = "";
	private ttsText: string = "";
	private contentType: "text" | "html" | "markdown" = "text";

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
		this.contentEl = this.container.querySelector("#paragraph-content");
		this.notesPanelEl = this.container.querySelector("#notes-panel");
		this.notesListEl = this.container.querySelector("#notes-panel-list");
		this.notesToggleEl = this.container.querySelector("#notes-toggle");

		this.notesToggleEl?.addEventListener("click", () => {
			this.notesOpen = !this.notesOpen;
			this.updateNotesPanel();
		});
		if (this.contentEl) {
			this.contentEl.addEventListener("scroll", this.handleScroll);
		}
		this.updateNotesPanel();
	}

	unmount(): void {
		if (this.container) {
			if (this.contentEl) {
				this.contentEl.removeEventListener("scroll", this.handleScroll);
			}
			this.container.innerHTML = "";
			this.container = null;
			this.contentEl = null;
			this.tokenEls.clear();
			this.textNodeIndex = [];
		}
	}

	setDocumentContext(
		originalText: string,
		contentType: "text" | "html" | "markdown",
		ttsText: string,
	) {
		this.originalText = originalText;
		this.ttsText = ttsText;
		this.contentType = contentType;
		// Reset rendered state so next update/render triggers full render
		if (this.contentEl) this.contentEl.innerHTML = "";
		this.tokenEls.clear();
		this.textNodeIndex = [];
		this.textNodeLength = 0;
	}

	/**
	 * Re-renders the text based on content type.
	 */
	renderText(tokens: Token[]) {
		if (!this.contentEl) return;

		this.contentEl.innerHTML = "";
		this.tokenEls.clear();
		this.textNodeIndex = [];
		this.textNodeLength = 0;
		this.lastTokens = tokens;

		if (this.contentType === "html") {
			const clean = DOMPurify.sanitize(this.originalText);
			this.contentEl.innerHTML = this.stripExternalImages(clean);
			// TODO: implement highlighting for HTML if possible
			this.applyAnnotationsToHtml();
			this.buildTextNodeIndex();
			return;
		} else if (this.contentType === "markdown") {
			const html = marked.parse(this.originalText);
			const clean = DOMPurify.sanitize(html as string);
			this.contentEl.innerHTML = this.stripExternalImages(clean);
			this.applyAnnotationsToHtml();
			this.buildTextNodeIndex();
			return;
		}

		// Default: Plain Text (Tokenized)
		const fragment = document.createDocumentFragment();

		tokens.forEach((token, index) => {
			const span = document.createElement("span");
			span.textContent = token.text;
			span.className = "token";
			span.dataset.index = String(index);

			if (token.type === "newline") {
				fragment.appendChild(document.createElement("br"));
				fragment.appendChild(document.createElement("br"));
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
			if (this.contentType !== "text" && this.originalText) {
				this.renderText(tokens);
			} else if (tokens.length > 0) {
				this.renderText(tokens);
			}
		}

		// Highlighting logic - only for TEXT mode for now
		if (this.contentType === "text") {
			if (this.activeTokenIndex !== -1) {
				const prevEl = this.tokenEls.get(this.activeTokenIndex);
				if (prevEl) prevEl.classList.remove("active");
			}

			this.activeTokenIndex = tokenIndex;
			const currEl = this.tokenEls.get(tokenIndex);

			if (currEl) {
				currEl.classList.add("active");

				// Auto-scroll logic
				currEl.scrollIntoView({
					behavior: "smooth",
					block: "center",
				});
			}
		} else {
			const token = tokens[tokenIndex];
			if (!token) return;

			if (!this.textNodeIndex.length) {
				this.buildTextNodeIndex();
			}

			if (this.shouldUseTextIndex()) {
				const didScroll = this.scrollToTextOffset(token.startOffset);
				if (didScroll) return;
			}

			this.scrollByOffsetRatio(token.startOffset);
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

	setAnnotations(
		annotations: AnnotationRange[],
		onSelect: ((id: string) => void) | null,
	) {
		this.annotations = annotations;
		this.onAnnotationSelect = onSelect;
		this.updateNotesPanel();

		if (this.contentType === "text") {
			this.applyAnnotationsToText(this.lastTokens);
		} else {
			this.applyAnnotationsToHtml();
			this.buildTextNodeIndex();
		}
	}

	setScrollHandler(handler: ((scrollTop: number) => void) | null) {
		this.onScroll = handler;
	}

	private stripExternalImages(html: string): string {
		const template = document.createElement("template");
		template.innerHTML = html;

		const images = template.content.querySelectorAll("img");
		images.forEach((img) => {
			const src = img.getAttribute("src") || "";
			if (!src) return;
			if (this.isExternalImageUrl(src)) img.remove();
		});

		return template.innerHTML;
	}

	private isExternalImageUrl(src: string): boolean {
		try {
			const url = new URL(src, window.location.origin);
			if (url.protocol !== "http:" && url.protocol !== "https:") return false;
			return url.origin !== window.location.origin;
		} catch {
			return false;
		}
	}

	private applyAnnotationsToText(tokens: Token[]) {
		if (!this.contentEl || !tokens.length) return;

		for (const [index, el] of this.tokenEls) {
			el.classList.remove("highlight-span", "note-span");
			const token = tokens[index];
			if (!token) continue;
			if (!this.annotations.length) continue;
			for (const annotation of this.annotations) {
				if (
					token.startOffset < annotation.endOffset &&
					token.endOffset > annotation.startOffset
				) {
					el.classList.add(
						annotation.type === "note" ? "note-span" : "highlight-span",
					);
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
		const walker = document.createTreeWalker(
			this.contentEl,
			NodeFilter.SHOW_TEXT,
		);
		let currentNode: Text | null = walker.nextNode() as Text | null;
		while (currentNode) {
			const text = currentNode.nodeValue || "";
			if (text.length > 0) {
				textNodes.push({
					node: currentNode,
					start: offset,
					end: offset + text.length,
				});
				offset += text.length;
			}
			currentNode = walker.nextNode() as Text | null;
		}

		for (const nodeInfo of textNodes) {
			const overlaps = this.annotations.filter(
				(range) =>
					range.endOffset > nodeInfo.start && range.startOffset < nodeInfo.end,
			);
			if (!overlaps.length) continue;

			const sorted = overlaps.sort((a, b) => a.startOffset - b.startOffset);
			const text = nodeInfo.node.nodeValue || "";
			let cursor = 0;
			const fragment = document.createDocumentFragment();

			for (const range of sorted) {
				const start = Math.max(0, range.startOffset - nodeInfo.start);
				const end = Math.min(text.length, range.endOffset - nodeInfo.start);
				if (start >= end || start < cursor) continue;
				const before = text.slice(cursor, start);
				if (before) fragment.appendChild(document.createTextNode(before));

				const span = document.createElement("span");
				span.className = range.type === "note" ? "note-span" : "highlight-span";
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

	private buildTextNodeIndex() {
		if (!this.contentEl) return;
		this.textNodeIndex = [];
		this.textNodeLength = 0;

		const walker = document.createTreeWalker(
			this.contentEl,
			NodeFilter.SHOW_TEXT,
		);
		let offset = 0;
		let currentNode: Text | null = walker.nextNode() as Text | null;

		while (currentNode) {
			const text = currentNode.nodeValue || "";
			if (text.length > 0) {
				this.textNodeIndex.push({
					node: currentNode,
					start: offset,
					end: offset + text.length,
				});
				offset += text.length;
			}
			currentNode = walker.nextNode() as Text | null;
		}

		this.textNodeLength = offset;
	}

	private findTextNodeEntryForOffset(
		offset: number,
	): { node: Text; start: number; end: number } | null {
		if (!this.textNodeIndex.length) return null;

		let low = 0;
		let high = this.textNodeIndex.length - 1;

		while (low <= high) {
			const mid = Math.floor((low + high) / 2);
			const entry = this.textNodeIndex[mid];
			if (offset < entry.start) {
				high = mid - 1;
			} else if (offset >= entry.end) {
				low = mid + 1;
			} else {
				return entry;
			}
		}

		return null;
	}

	private scrollToTextOffset(offset: number): boolean {
		if (!this.contentEl) return false;
		const entry = this.findTextNodeEntryForOffset(offset);
		if (!entry) return false;

		const localOffset = Math.min(
			Math.max(0, offset - entry.start),
			entry.end - entry.start,
		);
		const range = document.createRange();
		try {
			range.setStart(entry.node, localOffset);
			range.setEnd(entry.node, localOffset);
		} catch {
			return false;
		}

		const targetRect = range.getBoundingClientRect();
		const containerRect = this.contentEl.getBoundingClientRect();
		const targetTop =
			targetRect.top - containerRect.top + this.contentEl.scrollTop;
		const nextScrollTop = targetTop - this.contentEl.clientHeight / 2;
		this.contentEl.scrollTop = nextScrollTop;
		return true;
	}

	private shouldUseTextIndex(): boolean {
		if (!this.textNodeLength || !this.ttsText.length) return false;
		const delta = Math.abs(this.textNodeLength - this.ttsText.length);
		return delta / this.ttsText.length < 0.05;
	}

	private scrollByOffsetRatio(offset: number) {
		if (!this.contentEl || !this.ttsText.length) return;
		const maxScroll = this.contentEl.scrollHeight - this.contentEl.clientHeight;
		if (maxScroll <= 0) return;
		const ratio = Math.min(1, Math.max(0, offset / this.ttsText.length));
		this.contentEl.scrollTop = maxScroll * ratio;
	}

	private unwrapHighlights() {
		if (!this.contentEl) return;
		const spans = this.contentEl.querySelectorAll(
			"span.highlight-span, span.note-span",
		);
		spans.forEach((span) => {
			const parent = span.parentNode;
			if (!parent) return;
			parent.replaceChild(
				document.createTextNode(span.textContent || ""),
				span,
			);
			parent.normalize();
		});
	}

	private updateNotesPanel() {
		if (!this.notesPanelEl || !this.notesListEl || !this.notesToggleEl) return;
		this.notesPanelEl.classList.toggle("notes-panel-hidden", !this.notesOpen);
		this.notesToggleEl.textContent = this.notesOpen ? "Hide" : "Show";
		if (!this.notesOpen) return;

		if (!this.annotations.length) {
			this.notesListEl.innerHTML =
				'<div class="notes-empty">No notes or highlights yet.</div>';
			return;
		}

		const items = this.annotations
			.map((annotation) => {
				const label = annotation.type === "note" ? "Note" : "Highlight";
				const snippet = annotation.text
					? annotation.text
					: `Offset ${annotation.startOffset}`;
				return `
                <button class="notes-item" data-id="${annotation.id}">
                    <div class="notes-item-title">${label}</div>
                    <div class="notes-item-text">${snippet}</div>
                </button>
            `;
			})
			.join("");

		this.notesListEl.innerHTML = items;
		this.notesListEl.querySelectorAll(".notes-item").forEach((btn) => {
			btn.addEventListener("click", () => {
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
