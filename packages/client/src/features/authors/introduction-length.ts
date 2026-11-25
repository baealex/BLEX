const blockTags = /<(?:p|li|h[1-6]|blockquote|hr|img|table|tr)\b/gi;
const preformatted = /<pre\b[^>]*>([\s\S]*?)<\/pre>/gi;
const characterReference = /&(?:#\d+|#x[\da-f]+|[a-z][\da-z]*);/gi;

/**
 * Whether a sanitized introduction is long enough to start folded: more than about six lines of blocks,
 * counting each line of preformatted text, or more than about six lines of prose.
 */
export function isLongIntroduction(html: string): boolean {
    let lines = html.match(blockTags)?.length ?? 0;
    for (const [, code] of html.matchAll(preformatted)) lines += code.trim().split('\n').length;
    // A character reference such as `&amp;` shows as one character.
    const text = html
        .replace(/<[^>]*>/g, '')
        .replace(characterReference, '_')
        .trim();
    return lines > 6 || text.length > 360;
}
