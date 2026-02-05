import { v4 as uuidv4 } from 'uuid';
import type { Token } from '@spec/types';
import { countSentenceEndings, segmentTextToChunks, type SegmentChunk } from './segment';

export interface ReaderChunk {
    id: string;
    text: string;
    startOffset: number;
    endOffset: number;
    sentenceId: number;
    paraId: number;
}

export interface ParagraphSlice {
    text: string;
    startOffset: number;
}

export function buildReaderChunks(text: string): ReaderChunk[] {
    const paragraphs = splitParagraphs(text);
    const chunks: ReaderChunk[] = [];

    let sentenceId = 0;
    let paraId = 0;

    for (const para of paragraphs) {
        const segmentChunks = segmentTextToChunks(para.text);

        for (const segment of segmentChunks) {
            const globalStart = para.startOffset + segment.startOffset;
            const globalEnd = para.startOffset + segment.endOffset;
            const chunkText = text.slice(globalStart, globalEnd);

            chunks.push({
                id: uuidv4(),
                text: chunkText,
                startOffset: globalStart,
                endOffset: globalEnd,
                sentenceId,
                paraId
            });

            sentenceId += countSentenceEndings(segment.text);
        }

        sentenceId += 1;
        paraId += 1;
    }

    return chunks;
}

export function buildReaderChunksForParagraph(para: ParagraphSlice, sentenceId: number, paraId: number): ReaderChunk[] {
    const segmentChunks = segmentTextToChunks(para.text);
    const chunks: ReaderChunk[] = [];

    let localSentenceId = sentenceId;

    for (const segment of segmentChunks) {
        const globalStart = para.startOffset + segment.startOffset;
        const globalEnd = para.startOffset + segment.endOffset;
        const chunkText = para.text.slice(segment.startOffset, segment.endOffset);

        chunks.push({
            id: uuidv4(),
            text: chunkText,
            startOffset: globalStart,
            endOffset: globalEnd,
            sentenceId: localSentenceId,
            paraId
        });

        localSentenceId += countSentenceEndings(segment.text);
    }

    return chunks;
}

export function mapTokensToChunks(tokens: Token[], chunks: ReaderChunk[]): number[] {
    if (chunks.length === 0) return [];

    const mapping: number[] = new Array(tokens.length).fill(0);
    let chunkIndex = 0;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        while (chunkIndex < chunks.length && token.startOffset >= chunks[chunkIndex].endOffset) {
            chunkIndex += 1;
        }

        if (chunkIndex >= chunks.length) {
            mapping[i] = chunks.length - 1;
            continue;
        }

        if (token.startOffset < chunks[chunkIndex].startOffset) {
            mapping[i] = Math.max(0, chunkIndex - 1);
        } else {
            mapping[i] = chunkIndex;
        }
    }

    return mapping;
}

export function splitParagraphs(text: string): ParagraphSlice[] {
    if (!text) return [];

    const paragraphs: ParagraphSlice[] = [];
    const regex = /\n\s*\n/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
        const rawStart = lastIndex;
        const rawEnd = match.index;
        const slice = normalizeParagraph(text, rawStart, rawEnd);
        if (slice) paragraphs.push(slice);
        lastIndex = regex.lastIndex;
    }

    const tail = normalizeParagraph(text, lastIndex, text.length);
    if (tail) paragraphs.push(tail);

    return paragraphs;
}

function normalizeParagraph(text: string, start: number, end: number): ParagraphSlice | null {
    let left = start;
    let right = end;

    while (left < right && /\s/.test(text[left])) left++;
    while (right > left && /\s/.test(text[right - 1])) right--;

    if (right <= left) return null;

    return {
        text: text.slice(left, right),
        startOffset: left
    };
}

export type { SegmentChunk };
