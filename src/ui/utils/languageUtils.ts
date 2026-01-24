/**
 * Lightweight language detection using stop words and character sets.
 * Returns ISO 639-1 code (e.g. 'en', 'de', 'ru', 'es').
 */

// Common stop words for popular languages
const STOP_WORDS: Record<string, string[]> = {
    en: ['the', 'and', 'that', 'have', 'for', 'not', 'with', 'you', 'this'],
    de: ['der', 'die', 'das', 'und', 'ist', 'mit', 'auf', 'für', 'ein'],
    ru: ['что', 'как', 'это', 'для', 'нас', 'был', 'они', 'его', 'эта'],
    es: ['los', 'las', 'del', 'que', 'por', 'con', 'para', 'una', 'este'],
    fr: ['les', 'des', 'que', 'une', 'pour', 'dans', 'pas', 'sur', 'est'],
    it: ['gli', 'per', 'con', 'che', 'una', 'del', 'nel', 'più', 'non']
};

export function detectLanguage(text: string): string {
    if (!text || text.trim().length === 0) return 'en';

    const cleanText = text.toLowerCase();

    // Check for Cyrillic (Russian/Ukrainian/etc - simplifed to 'ru' for now as primary use case)
    if (/[а-яА-ЯёЁ]/.test(text)) {
        return 'ru';
    }

    const words = cleanText.split(/\s+/).slice(0, 100); // Sample first 100 words
    const counts: Record<string, number> = {};

    for (const lang in STOP_WORDS) {
        counts[lang] = 0;
        const stopWords = STOP_WORDS[lang];
        for (const word of words) {
            if (stopWords.includes(word)) {
                counts[lang]++;
            }
        }
    }

    // Find the language with the most stop word matches
    let detectedLang = 'en';
    let maxCount = 0;

    for (const lang in counts) {
        if (counts[lang] > maxCount) {
            maxCount = counts[lang];
            detectedLang = lang;
        }
    }

    // Heuristics for special cases or if no stop words found
    if (maxCount === 0) {
        // Simple regex check for Spanish/Romance common endings or characters if not English
        if (/[áéíóúüñ]/i.test(text)) return 'es';
    }

    return detectedLang;
}
