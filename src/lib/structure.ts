export type ContentType = 'text' | 'html' | 'markdown';

export interface Heading {
    level: number;
    text: string;
    startOffset: number;
}

export interface StructureMap {
    headings: Heading[];
    textLength: number;
    title?: string;
}

export interface StructuralContext {
    chapterLabel: string;
    sectionLabel: string | null;
    chapterProgress: number;
    chapterStart: number;
    chapterEnd: number;
    hasStructure: boolean;
}

export function buildStructureMap(input: {
    title?: string;
    originalText: string;
    ttsText: string;
    contentType: ContentType;
}): StructureMap {
    const { originalText, ttsText, contentType, title } = input;
    const headings = extractHeadings(originalText, contentType);
    const mapped = mapHeadingsToText(headings, ttsText);
    return {
        headings: mapped,
        textLength: ttsText.length,
        title
    };
}

export function getStructuralContext(map: StructureMap, offset: number): StructuralContext {
    const textLength = map.textLength || 0;
    const safeOffset = clamp(offset, 0, textLength);
    const headings = map.headings.slice().sort((a, b) => a.startOffset - b.startOffset);

    if (headings.length === 0) {
        return {
            chapterLabel: map.title || 'Untitled',
            sectionLabel: null,
            chapterProgress: textLength > 0 ? (safeOffset / textLength) * 100 : 0,
            chapterStart: 0,
            chapterEnd: textLength,
            hasStructure: false
        };
    }

    const currentIndex = findCurrentHeadingIndex(headings, safeOffset);
    const chapterHeading = findChapterHeading(headings, currentIndex);
    const chapterStart = chapterHeading ? chapterHeading.startOffset : 0;
    const chapterEnd = findNextChapterStart(headings, chapterHeading) ?? textLength;
    const sectionHeading = findSectionHeading(headings, currentIndex, chapterStart, Boolean(chapterHeading));

    const denominator = Math.max(1, chapterEnd - chapterStart);
    const chapterProgress = ((safeOffset - chapterStart) / denominator) * 100;

    return {
        chapterLabel: chapterHeading?.text || map.title || 'Untitled',
        sectionLabel: sectionHeading?.text || null,
        chapterProgress: clamp(chapterProgress, 0, 100),
        chapterStart,
        chapterEnd,
        hasStructure: true
    };
}

function extractHeadings(text: string, contentType: ContentType): Heading[] {
    if (!text) return [];
    if (contentType === 'markdown') return extractMarkdownHeadings(text);
    if (contentType === 'html') return extractHtmlHeadings(text);
    return extractPlainTextHeadings(text);
}

function extractMarkdownHeadings(text: string): Heading[] {
    const headings: Heading[] = [];
    const regex = /^(#{1,6})\s+(.+)$/gm;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
        const level = match[1].length;
        const raw = match[2].trim();
        const cleaned = raw.replace(/\s+#+\s*$/, '').trim();
        if (!cleaned) continue;
        headings.push({
            level,
            text: cleaned,
            startOffset: match.index
        });
    }
    return headings;
}

function extractHtmlHeadings(html: string): Heading[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const elements = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    return elements
        .map(el => {
            const level = parseInt(el.tagName.replace('H', ''), 10);
            const text = (el.textContent || '').trim();
            return {
                level: Number.isNaN(level) ? 1 : level,
                text,
                startOffset: 0
            } as Heading;
        })
        .filter(h => h.text.length > 0);
}

function extractPlainTextHeadings(text: string): Heading[] {
    const headings: Heading[] = [];
    const lines = text.split(/\r?\n/);
    const offsets: number[] = [];
    let cursor = 0;
    for (const line of lines) {
        offsets.push(cursor);
        cursor += line.length + 1;
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!trimmed) continue;

        const prevBlank = i === 0 ? true : lines[i - 1].trim().length === 0;
        const nextBlank = i === lines.length - 1 ? true : lines[i + 1].trim().length === 0;

        const chapterMatch = /^(chapter|part|book)\b/i.test(trimmed);
        const sectionMatch = /^section\b/i.test(trimmed);
        const capsHeading = isAllCapsHeading(trimmed, prevBlank, nextBlank);

        if (chapterMatch || capsHeading) {
            headings.push({
                level: 1,
                text: trimmed,
                startOffset: offsets[i]
            });
        } else if (sectionMatch) {
            headings.push({
                level: 2,
                text: trimmed,
                startOffset: offsets[i]
            });
        }
    }

    return headings;
}

function mapHeadingsToText(headings: Heading[], ttsText: string): Heading[] {
    if (!ttsText) return headings.map(h => ({ ...h, startOffset: 0 }));
    const mapped: Heading[] = [];
    let cursor = 0;
    for (const heading of headings) {
        const index = findHeadingIndex(ttsText, heading.text, cursor);
        const startOffset = index >= 0 ? index : cursor;
        mapped.push({
            level: heading.level,
            text: heading.text,
            startOffset
        });
        if (index >= 0) cursor = index + heading.text.length;
    }
    return mapped.sort((a, b) => a.startOffset - b.startOffset);
}

function findHeadingIndex(text: string, heading: string, start: number): number {
    if (!heading) return -1;
    const directIndex = text.indexOf(heading, start);
    if (directIndex >= 0) return directIndex;

    const lowerText = text.toLowerCase();
    const lowerHeading = heading.toLowerCase();
    const lowerIndex = lowerText.indexOf(lowerHeading, start);
    if (lowerIndex >= 0) return lowerIndex;

    const escaped = escapeRegex(heading).replace(/\s+/g, '\\s+');
    const regex = new RegExp(escaped, 'i');
    const slice = text.slice(start);
    const match = slice.match(regex);
    if (match && typeof match.index === 'number') {
        return start + match.index;
    }

    return -1;
}

function findCurrentHeadingIndex(headings: Heading[], offset: number): number {
    let result = -1;
    for (let i = 0; i < headings.length; i++) {
        if (headings[i].startOffset <= offset) result = i;
        else break;
    }
    return result;
}

function findChapterHeading(headings: Heading[], currentIndex: number): Heading | null {
    for (let i = currentIndex; i >= 0; i--) {
        if (headings[i].level === 1) return headings[i];
    }
    return null;
}

function findNextChapterStart(headings: Heading[], chapterHeading: Heading | null): number | null {
    if (!chapterHeading) return null;
    const startOffset = chapterHeading.startOffset;
    for (const heading of headings) {
        if (heading.level === 1 && heading.startOffset > startOffset) return heading.startOffset;
    }
    return null;
}

function findSectionHeading(headings: Heading[], currentIndex: number, chapterStart: number, hasChapter: boolean): Heading | null {
    for (let i = currentIndex; i >= 0; i--) {
        if (headings[i].level >= 2 && headings[i].level <= 3 && headings[i].startOffset >= chapterStart) {
            return headings[i];
        }
    }

    if (!hasChapter && currentIndex >= 0) {
        const current = headings[currentIndex];
        if (current.level >= 2 && current.level <= 3) return current;
    }

    return null;
}

function isAllCapsHeading(text: string, prevBlank: boolean, nextBlank: boolean): boolean {
    if (!prevBlank || !nextBlank) return false;
    if (text.length < 4 || text.length > 60) return false;
    if (!/[A-Z]/.test(text)) return false;
    if (/[a-z]/.test(text)) return false;
    return true;
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}
