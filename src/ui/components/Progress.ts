import { buildStructureMap, getStructuralContext, type ContentType, type StructureMap } from '../../lib/structure';

export class Progress {
    private container: HTMLElement;
    private labelEl!: HTMLDivElement;
    private percentEl!: HTMLDivElement;
    private fillEl!: HTMLDivElement;
    private structureMap: StructureMap | null = null;
    private lastLabel: string | null = null;
    private lastPercent: number | null = null;

    constructor(container: HTMLElement) {
        this.container = container;
        this.render();
    }

    private render() {
        this.container.innerHTML = `
            <div class="structure-progress" id="structure-progress">
                <div class="structure-label" id="structure-label"></div>
                <div class="structure-bar" id="structure-bar">
                    <div class="structure-bar-fill" id="structure-bar-fill"></div>
                </div>
                <div class="structure-percent" id="structure-percent"></div>
            </div>
        `;

        this.labelEl = this.container.querySelector('#structure-label') as HTMLDivElement;
        this.percentEl = this.container.querySelector('#structure-percent') as HTMLDivElement;
        this.fillEl = this.container.querySelector('#structure-bar-fill') as HTMLDivElement;
    }

    setDocumentContext(input: {
        title?: string;
        originalText: string;
        ttsText: string;
        contentType: ContentType;
    }) {
        this.structureMap = buildStructureMap(input);
        this.lastLabel = null;
        this.lastPercent = null;
        this.setVisible(true);
    }

    updatePosition(offset: number) {
        if (!this.structureMap) return;
        const context = getStructuralContext(this.structureMap, offset);
        const label = context.sectionLabel
            ? `${context.chapterLabel} -> ${context.sectionLabel}`
            : context.chapterLabel;
        const percent = Math.round(context.chapterProgress);

        if (label !== this.lastLabel) {
            this.labelEl.textContent = label;
            this.lastLabel = label;
        }

        if (percent !== this.lastPercent) {
            this.percentEl.textContent = `${percent}%`;
            this.fillEl.style.width = `${percent}%`;
            this.lastPercent = percent;
        }
    }

    clear() {
        this.structureMap = null;
        this.labelEl.textContent = '';
        this.percentEl.textContent = '';
        this.fillEl.style.width = '0%';
        this.lastLabel = null;
        this.lastPercent = null;
    }

    setVisible(visible: boolean) {
        this.container.classList.toggle('structure-progress-hidden', !visible);
    }
}
