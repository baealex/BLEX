const RELOAD_KEY = 'blex:catalog-reload';
const RELOAD_INTERVAL = 60_000;

/** True while a screen would ask before the page unloads, the same check the application makes. */
function warnsBeforeLeaving(): boolean {
    return (window.blexHistory?._getBlockers() ?? []).some(({ enableBeforeUnload = true }) =>
        typeof enableBeforeUnload === 'function' ? enableBeforeUnload() : enableBeforeUnload
    );
}

/**
 * Browsers never refetch a failed module, so only a new page can retry. Unsaved screen edits, typed text,
 * and a repeat failure stop it. Controlled fields and editors can hide typed text, so the leave warning counts too.
 */
export function reloadAfterCatalogFailure(): void {
    if (warnsBeforeLeaving()) return;
    const fields = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea');
    if ([...fields].some((field) => field.value !== field.defaultValue)) return;
    try {
        if (Date.now() - Number(sessionStorage.getItem(RELOAD_KEY)) < RELOAD_INTERVAL) return;
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    } catch {
        return;
    }
    window.location.reload();
}
