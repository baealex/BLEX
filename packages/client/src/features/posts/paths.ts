export function publicPostPath(username: string, slug: string): string {
    return `/@${encodeURIComponent(username)}/${encodeURIComponent(slug)}`;
}
