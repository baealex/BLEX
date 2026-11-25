const RELOAD_KEY = 'blex:catalog-reload';
const RELOAD_INTERVAL = 60_000;

/**
 * Browsers never refetch a failed module, so only a new page can retry. Unsaved screen edits, typed text,
 * and a repeat failure stop it. Controlled fields and editors can hide typed text, so the application
 * cancels the check while a screen would warn before leaving.
 */
export function reloadAfterCatalogFailure(): void {
    if (!document.dispatchEvent(new Event('blex:before-reload', { cancelable: true }))) return;
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
