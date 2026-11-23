const RELOAD_KEY = 'blex:catalog-reload';
const RELOAD_INTERVAL = 60_000;

/** Browsers never refetch a failed module, so only a new page can retry. Typed text and a repeat failure stop it. */
export function reloadAfterCatalogFailure(): void {
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
