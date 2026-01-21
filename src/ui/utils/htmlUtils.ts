
/**
 * Extracts plain text from an HTML string, removing script and style tags.
 * Adds newlines after block elements for better TTS sentence separation.
 * @param html The HTML string to parse.
 * @returns The extracted plain text.
 */
export function extractTextFromHtml(html: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Remove unwanted elements
    const unwantedTags = ['script', 'style', 'noscript', 'iframe', 'object', 'embed', 'head'];
    unwantedTags.forEach(tag => {
        const elements = doc.querySelectorAll(tag);
        elements.forEach(el => el.remove());
    });

    // Add newlines after block elements for sentence separation
    const blockTags = ['p', 'div', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'tr', 'blockquote'];
    blockTags.forEach(tag => {
        const elements = doc.querySelectorAll(tag);
        elements.forEach(el => {
            el.insertAdjacentText('afterend', '\n');
        });
    });

    // Get text content and normalize whitespace
    let text = doc.body.textContent || '';
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.replace(/[ \t]+/g, ' ');

    return text.trim();
}

