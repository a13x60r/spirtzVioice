export interface SegmentChunk {
    text: string;
    startOffset: number;
    endOffset: number;
}

const WORD_REGEX = /[\p{L}\p{N}''\u2019]+/gu;
const SENTENCE_END_REGEX = /[.!?]/g;
const CONJUNCTIONS: Record<string, string[]> = {
    en: ['and', 'but', 'or', 'so', 'because', 'however', 'therefore', 'although', 'while'],
    de: ['und', 'aber', 'oder', 'denn', 'weil', 'jedoch', 'deshalb', 'obwohl', 'während'],
    ru: ['и', 'но', 'или', 'так', 'потому что', 'однако', 'поэтому', 'хотя', 'пока']
};

const MIN_WORDS = 3;
const SOFT_MAX_WORDS = 12;
const HARD_MAX_WORDS = 15;

export function segmentTextToChunks(text: string, language: string = 'en'): SegmentChunk[] {
    if (!text || text.trim().length === 0) return [];

    const splitPoints = new Set<number>();

    for (const match of text.matchAll(/[.?!;:]/g)) {
        splitPoints.add((match.index ?? 0) + match[0].length);
    }

    const conjunctionRegex = getConjunctionRegex(language);
    for (const match of text.matchAll(conjunctionRegex)) {
        splitPoints.add((match.index ?? 0) + 1);
    }

    const orderedSplits = Array.from(splitPoints).sort((a, b) => a - b);

    const baseChunks: SegmentChunk[] = [];
    let start = 0;
    for (const end of orderedSplits) {
        if (end <= start) continue;
        const chunk = buildChunk(text, start, end);
        if (chunk) baseChunks.push(chunk);
        start = end;
    }

    if (start < text.length) {
        const chunk = buildChunk(text, start, text.length);
        if (chunk) baseChunks.push(chunk);
    }

    const merged = mergeSmallChunks(text, baseChunks);
    const capped = capChunkLength(text, merged);
    return mergeSmallChunks(text, capped);
}

function getConjunctionRegex(language: string): RegExp {
    const base = language.split('-')[0].toLowerCase();
    const list = CONJUNCTIONS[base] || CONJUNCTIONS.en;
    const pattern = list.map(entry => entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    return new RegExp(`,\\s+(?:${pattern})(?=\\s|$)`, 'giu');
}

function buildChunk(text: string, start: number, end: number): SegmentChunk | null {
    let left = start;
    let right = end;

    while (left < right && /\s/.test(text[left])) left++;
    while (right > left && /\s/.test(text[right - 1])) right--;

    if (right <= left) return null;

    return {
        text: text.slice(left, right),
        startOffset: left,
        endOffset: right
    };
}

function countWords(text: string): number {
    return text.match(WORD_REGEX)?.length ?? 0;
}

function mergeSmallChunks(text: string, chunks: SegmentChunk[]): SegmentChunk[] {
    if (chunks.length === 0) return [];

    const merged: SegmentChunk[] = [];
    let i = 0;

    while (i < chunks.length) {
        const current = chunks[i];
        const currentWords = countWords(current.text);

        if (currentWords < MIN_WORDS && i + 1 < chunks.length) {
            const next = chunks[i + 1];
            const combined = buildChunk(text, current.startOffset, next.endOffset);
            if (combined) {
                merged.push(combined);
                i += 2;
                continue;
            }
        }

        merged.push(current);
        i += 1;
    }

    if (merged.length > 1) {
        const last = merged[merged.length - 1];
        if (countWords(last.text) < MIN_WORDS) {
            const prev = merged[merged.length - 2];
            const combined = buildChunk(text, prev.startOffset, last.endOffset);
            if (combined) {
                merged.splice(merged.length - 2, 2, combined);
            }
        }
    }

    return merged;
}

function capChunkLength(text: string, chunks: SegmentChunk[]): SegmentChunk[] {
    const capped: SegmentChunk[] = [];

    for (const chunk of chunks) {
        const words = Array.from(chunk.text.matchAll(WORD_REGEX));
        if (words.length <= HARD_MAX_WORDS) {
            capped.push(chunk);
            continue;
        }

        let cursorStart = chunk.startOffset;
        let wordIndex = 0;

        while (wordIndex < words.length) {
            const remainingWords = words.length - wordIndex;
            if (remainingWords <= HARD_MAX_WORDS) break;

            const remainderAfterHard = remainingWords - HARD_MAX_WORDS;
            const targetCount = remainderAfterHard > 0 && remainderAfterHard < SOFT_MAX_WORDS
                ? SOFT_MAX_WORDS
                : HARD_MAX_WORDS;
            const splitWord = words[wordIndex + targetCount - 1];
            const rawSplitEnd = chunk.startOffset + (splitWord.index ?? 0) + splitWord[0].length;

            let splitEnd = rawSplitEnd;
            while (splitEnd < chunk.endOffset && /[)\]"'\u2019\u201D,.;:!?]/.test(text[splitEnd])) {
                splitEnd++;
            }

            const partial = buildChunk(text, cursorStart, splitEnd);
            if (partial) capped.push(partial);

            cursorStart = splitEnd;
            while (wordIndex < words.length && (chunk.startOffset + (words[wordIndex].index ?? 0)) < cursorStart) {
                wordIndex++;
            }
        }

        const remainder = buildChunk(text, cursorStart, chunk.endOffset);
        if (remainder) capped.push(remainder);
    }

    return capped;
}

export function countSentenceEndings(text: string): number {
    return text.match(SENTENCE_END_REGEX)?.length ?? 0;
}
