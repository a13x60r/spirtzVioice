
/**
 * Extracts plain text from an HTML string, removing script and style tags.
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

    // Prefer innerText if available (it handles CSS visibility), fallback to textContent
    // Note: In some non-attached DOM environments, innerText might be empty.
    // However, since we've cleaned the DOM, textContent is safer than before.
    // We try to simulate a "render" by just taking the text content of the body.

    // For a robust "readable" text, we often want to preserve some newlines for block elements.
    // But for this simple implementation, let's stick to textContent of the cleaned body.
    // A better approach for "readability" might involve replacing block tags with newlines before getting text,
    // but the requirement is "unreadable from imported text" (likely due to scripts).

    return (doc.body.textContent || '').trim();
}
