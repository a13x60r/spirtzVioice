import type { Token } from '@spec/types';
import type { ReaderChunk } from './readerModel';

export function prevChunk(currentChunkIndex: number, chunks: ReaderChunk[]): number {
    if (!chunks.length) return 0;
    if (currentChunkIndex <= 0) return 0;
    return Math.min(chunks.length - 1, Math.max(0, currentChunkIndex - 1));
}

export function prevSentence(currentTokenIndex: number, tokens: Token[]): number {
    if (!tokens.length) return 0;
    const currentToken = tokens[currentTokenIndex] ?? tokens[0];
    const currentSentenceId = currentToken.sentenceId;

    const currentStart = tokens.find(t => t.sentenceId === currentSentenceId);
    if (currentStart && currentStart.index < currentTokenIndex) {
        return currentStart.index;
    }

    const targetSentenceId = currentSentenceId - 1;
    if (targetSentenceId < 0) return 0;

    const targetToken = tokens.find(t => t.sentenceId === targetSentenceId);
    if (!targetToken) return 0;
    return targetToken.index;
}

export function rewindByMs(currentTimeSec: number, ms: number, durationSec: number): number {
    const offset = ms / 1000;
    const target = currentTimeSec - offset;
    return Math.max(0, Math.min(target, durationSec));
}
