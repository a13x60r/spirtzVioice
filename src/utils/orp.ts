/**
 * ORP (Optimal Recognition Point) detection for Spritz-like RSVP rendering.
 *
 * Returns the 0-based index of the character in `word` that should be highlighted.
 *
 * Notes:
 * - This uses a common practical mapping used in RSVP apps (Spritz-style):
 *   length 1–2 -> 1st char
 *   length 3–5 -> 2nd char
 *   length 6–9 -> 3rd char
 *   length 10+ -> 4th char
 * - It preserves punctuation by default (so "hello," highlights within the token).
 *   If you want ORP on letters only (excluding punctuation), use `getOrpIndexLettersOnly`.
 */

export type OrpResult = {
    word: string;
    orpIndex: number; // 0-based index into `word`
    orpChar: string;  // character at orpIndex
};

export function getOrpIndex(word: string): number {
    if (word.length === 0) return 0;

    const len = word.length;

    // 1–2 -> index 0
    if (len <= 2) return 0;

    // 3–5 -> index 1
    if (len <= 5) return 1;

    // 6–9 -> index 2
    if (len <= 9) return 2;

    // 10+ -> index 3
    return 3;
}

export function getOrp(word: string): OrpResult {
    const idx = clampIndex(getOrpIndex(word), word.length);
    return { word, orpIndex: idx, orpChar: word.charAt(idx) };
}

/**
 * Letters-only ORP:
 * Computes ORP based on letter/digit characters, but returns an index into the original string.
 * Useful when tokens include punctuation like `"hello,"`, `"“quoted”"`, `"end."`.
 */
export function getOrpIndexLettersOnly(word: string): number {
    if (word.length === 0) return 0;

    // Collect indices of "core" characters (letters/digits). Keep it Unicode-friendly.
    // \p{L} letters, \p{N} numbers (requires ES2018+ with Unicode property escapes).
    const coreIndices: number[] = [];
    for (let i = 0; i < word.length; i++) {
        const ch = word[i];
        if (isLetterOrNumber(ch)) coreIndices.push(i);
    }

    // If no letters/numbers, fall back to first char.
    if (coreIndices.length === 0) return 0;

    // Determine ORP position based on core length (not total token length).
    const coreLen = coreIndices.length;
    let corePos: number;
    if (coreLen <= 2) corePos = 0;
    else if (coreLen <= 5) corePos = 1;
    else if (coreLen <= 9) corePos = 2;
    else corePos = 3;

    // Map core position back to original string index.
    return coreIndices[clampIndex(corePos, coreIndices.length)];
}

export function getOrpLettersOnly(word: string): OrpResult {
    const idx = clampIndex(getOrpIndexLettersOnly(word), word.length);
    return { word, orpIndex: idx, orpChar: word.charAt(idx) };
}

/**
 * Split a token into [prefix, highlightedChar, suffix] for rendering.
 */
export function splitForHighlight(word: string, orpIndex: number): [string, string, string] {
    if (word.length === 0) return ["", "", ""];
    const idx = clampIndex(orpIndex, word.length);
    const prefix = word.slice(0, idx);
    const mid = word.charAt(idx);
    const suffix = word.slice(idx + 1);
    return [prefix, mid, suffix];
}

/**
 * RSVP helper: tokenize text into "words" while retaining newlines if desired.
 * This is a conservative tokenizer: splits on whitespace.
 */
export function tokenize(text: string): string[] {
    // Split on any whitespace, drop empty.
    return text.split(/\s+/g).filter(Boolean);
}

/* ------------------------- internal helpers ------------------------- */

function clampIndex(index: number, length: number): number {
    if (length <= 0) return 0;
    if (index < 0) return 0;
    if (index >= length) return length - 1;
    return index;
}

function isLetterOrNumber(ch: string): boolean {
    // Unicode property escapes. If your runtime doesn’t support this,
    // replace with /[A-Za-z0-9]/ and accept ASCII-only behavior.
    return /\p{L}|\p{N}/u.test(ch);
}
