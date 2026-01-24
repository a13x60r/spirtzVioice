import { describe, it, expect } from 'vitest';
import { detectLanguage } from '../languageUtils';

describe('detectLanguage', () => {
    it('should detect English', () => {
        const text = "The quick brown fox jumps over the lazy dog. It was a sunny day and everyone was happy and looking for a way to have fun.";
        expect(detectLanguage(text)).toBe('en');
    });

    it('should detect German', () => {
        const text = "Der schnelle braune Fuchs springt über den faulen Hund. Es war ein sonniger Tag und alle waren glücklich und suchten nach einer Möglichkeit, Spaß zu haben.";
        expect(detectLanguage(text)).toBe('de');
    });

    it('should detect Russian (Cyrillic heuristic)', () => {
        const text = "Съешь же ещё этих мягких французских булок, да выпей чаю. Было солнечное утро, и все были счастливы.";
        expect(detectLanguage(text)).toBe('ru');
    });

    it('should detect Spanish', () => {
        const text = "El veloz murciélago hindú comía feliz cardillo y escabeche. Era un día soleado y todos estaban felices buscando una manera de divertirse.";
        expect(detectLanguage(text)).toBe('es');
    });

    it('should detect French', () => {
        const text = "Le rapide renard brun saute par-dessus le chien paresseux. C'était une journée ensoleillée et tout le monde était heureux de chercher un moyen de s'amuser.";
        expect(detectLanguage(text)).toBe('fr');
    });

    it('should fallback to English for empty or short unknown text', () => {
        expect(detectLanguage("")).toBe('en');
        expect(detectLanguage("   ")).toBe('en');
        expect(detectLanguage("xyz abc")).toBe('en');
    });

    it('should use character heuristic for Spanish if no stop words found', () => {
        const text = "mañana";
        expect(detectLanguage(text)).toBe('es');
    });
});
