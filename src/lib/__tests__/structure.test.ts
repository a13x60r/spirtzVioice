import { describe, it, expect } from 'vitest';
import { buildStructureMap, getStructuralContext } from '../structure';

describe('structure map', () => {
    it('maps markdown headings to tts offsets', () => {
        const originalText = '# Chapter One\n\n## Section A\nText here\n\n# Chapter Two\nMore';
        const ttsText = 'Chapter One\n\nSection A\nText here\n\nChapter Two\nMore';

        const map = buildStructureMap({
            title: 'Test Doc',
            originalText,
            ttsText,
            contentType: 'markdown'
        });

        expect(map.headings.length).toBe(3);

        const offset = ttsText.indexOf('Text here');
        const context = getStructuralContext(map, offset);
        expect(context.chapterLabel).toBe('Chapter One');
        expect(context.sectionLabel).toBe('Section A');
        expect(context.chapterProgress).toBeGreaterThan(0);
        expect(context.chapterProgress).toBeLessThan(100);
    });

    it('parses html headings and computes context', () => {
        const originalText = '<h1>Intro</h1><p>Body</p><h2>Details</h2><p>More</p>';
        const ttsText = 'Intro\n\nBody\n\nDetails\n\nMore';

        const map = buildStructureMap({
            title: 'HTML Doc',
            originalText,
            ttsText,
            contentType: 'html'
        });

        expect(map.headings.length).toBe(2);

        const offset = ttsText.indexOf('More');
        const context = getStructuralContext(map, offset);
        expect(context.chapterLabel).toBe('Intro');
        expect(context.sectionLabel).toBe('Details');
    });

    it('detects plain text headings with heuristics', () => {
        const originalText = 'CHAPTER ONE\n\nSome text.\n\nSection 1\nDetails here.';
        const ttsText = originalText;

        const map = buildStructureMap({
            title: 'Plain Doc',
            originalText,
            ttsText,
            contentType: 'text'
        });

        expect(map.headings.length).toBe(2);

        const offset = ttsText.indexOf('Details');
        const context = getStructuralContext(map, offset);
        expect(context.chapterLabel).toBe('CHAPTER ONE');
        expect(context.sectionLabel).toBe('Section 1');
    });

    it('falls back to document progress when no headings', () => {
        const originalText = 'Just some text.';
        const ttsText = originalText;

        const map = buildStructureMap({
            title: 'No Headings',
            originalText,
            ttsText,
            contentType: 'text'
        });

        const context = getStructuralContext(map, 5);
        expect(context.hasStructure).toBe(false);
        expect(context.chapterLabel).toBe('No Headings');
    });
});
