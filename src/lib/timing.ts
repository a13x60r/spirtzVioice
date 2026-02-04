export interface TimingOptions {
    commaPauseMs?: number;
    semicolonPauseMs?: number;
    sentenceEndPauseMs?: number;
    longWordBonusMs?: number;
}

const DEFAULT_TIMING: Required<TimingOptions> = {
    commaPauseMs: 120,
    semicolonPauseMs: 200,
    sentenceEndPauseMs: 450,
    longWordBonusMs: 35
};

export function computeDelayMs(chunkText: string, baseWpm: number, opts: TimingOptions = {}): number {
    if (!chunkText) return 0;

    const timing = { ...DEFAULT_TIMING, ...opts };
    const safeWpm = Math.max(1, baseWpm);
    const baseMsPerWord = 60000 / safeWpm;

    const words = chunkText.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    const commaCount = (chunkText.match(/,/g) || []).length;
    const semicolonCount = (chunkText.match(/;/g) || []).length;
    const sentenceEndCount = (chunkText.match(/[.!?]/g) || []).length;

    const longWordCount = words.reduce((count, word) => {
        const cleaned = word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
        if (cleaned.length >= 9) return count + 1;
        return count;
    }, 0);

    const baseDelay = baseMsPerWord * wordCount;
    const punctuationDelay = (commaCount * timing.commaPauseMs)
        + (semicolonCount * timing.semicolonPauseMs)
        + (sentenceEndCount * timing.sentenceEndPauseMs);
    const longWordDelay = longWordCount * timing.longWordBonusMs;

    return baseDelay + punctuationDelay + longWordDelay;
}
