export function minify(text: string) {
    return text.replace(/\s/g, '')
        .replace(/function/g, 'function ')
        .replace(/var/g, 'var ')
        .replace(/new/g, 'new ');
}

export function unescape(text: string) {
    return text.replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

export function slugify(text: string) {
    return text.toLowerCase().replace(/[\s\\,\\.]/g, '-');
}