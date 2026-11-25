/**
 * Moving between an author's overview and their posts or series carries their avatar from the card to the
 * compact header and back, so the reader sees they stay with the same person. Nothing else animates.
 */

export type AuthorAvatarMove = 'to-header' | 'to-card';

const authorPage = /^\/@([^/]+)(?:\/(posts|series))?\/?$/;

function authorPath(url: string): { author: string; tab: string | undefined } | null {
    let pathname: string;
    try {
        pathname = new URL(url, 'https://blex.invalid').pathname;
    } catch {
        return null;
    }
    const match = authorPage.exec(pathname);
    if (!match) return null;
    let author = match[1];
    try {
        author = decodeURIComponent(author);
    } catch {
        // An undecodable name still compares by its raw text.
    }
    return { author, tab: match[2] };
}

/** Which way the avatar moves between two pages, or null when they do not share it. */
export function authorAvatarMove(from: string, to: string): AuthorAvatarMove | null {
    const before = authorPath(from);
    const after = authorPath(to);
    if (!before || !after || before.author !== after.author) return null;
    if (!before.tab && after.tab) return 'to-header';
    if (before.tab && !after.tab) return 'to-card';
    return null;
}

function canAnimate(): boolean {
    return (
        typeof document.startViewTransition === 'function' &&
        document.visibilityState === 'visible' &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
}

/** Shows the next page, carrying the avatar across when the browser can and the reader allows motion. */
export function showWithAuthorAvatar(move: AuthorAvatarMove | null, show: () => void): void {
    if (!move || !canAnimate()) {
        show();
        return;
    }
    const root = document.documentElement;
    root.dataset.authorAvatarMove = move;
    const transition = document.startViewTransition(show);
    transition.updateCallbackDone.catch((error: unknown) => {
        console.error('BLEX could not show the next page.', error);
    });
    void transition.finished
        .catch(() => undefined)
        .finally(() => {
            if (root.dataset.authorAvatarMove === move) delete root.dataset.authorAvatarMove;
        });
}
