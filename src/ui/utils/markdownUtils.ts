/**
 * Strips markdown formatting from text to make it TTS-ready.
 * Preserves the readable text content while removing syntax.
 */
export function stripMarkdown(md: string): string {
    if (!md) return '';

    let text = md;

    // Remove code blocks (``` ... ```)
    text = text.replace(/```[\s\S]*?```/g, '');

    // Remove inline code (`code`)
    text = text.replace(/`([^`]+)`/g, '$1');

    // Remove images ![alt](url)
    text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');

    // Convert links [text](url) to just text
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // Remove reference-style links [text][ref]
    text = text.replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1');

    // Remove reference definitions [ref]: url
    text = text.replace(/^\s*\[[^\]]+\]:\s*.*$/gm, '');

    // Remove headers (# ## ### etc) - keep text
    text = text.replace(/^#{1,6}\s+(.*)$/gm, '$1');

    // Remove bold/italic (**text**, __text__, *text*, _text_)
    text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
    text = text.replace(/(\*|_)(.*?)\1/g, '$2');

    // Remove strikethrough ~~text~~
    text = text.replace(/~~(.*?)~~/g, '$1');

    // Remove horizontal rules (---, ***, ___)
    text = text.replace(/^[-*_]{3,}\s*$/gm, '');

    // Remove blockquote markers (>)
    text = text.replace(/^>\s*/gm, '');

    // Remove list markers (-, *, +, 1.)
    text = text.replace(/^[\s]*[-*+]\s+/gm, '');
    text = text.replace(/^[\s]*\d+\.\s+/gm, '');

    // Remove HTML tags that might be embedded
    text = text.replace(/<[^>]+>/g, '');

    // Normalize whitespace
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.replace(/[ \t]+/g, ' ');

    return text.trim();
}
