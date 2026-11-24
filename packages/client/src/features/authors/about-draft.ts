import { activateDocumentLocale } from '../../i18n';
import { ui } from '../../i18n/public-ui.js';

const draftKey = () => `blex:about-draft:${location.pathname}`;

/** Browser storage can be unavailable, and the editor must keep working without it. */
function withStorage<T>(use: (storage: Storage) => T): T | undefined {
    try {
        return use(sessionStorage);
    } catch {
        return undefined;
    }
}

const clearDraft = () => withStorage((storage) => storage.removeItem(draftKey()));

function restoreDraft(input: HTMLTextAreaElement): void {
    const draft = input.value === input.defaultValue ? withStorage((storage) => storage.getItem(draftKey())) : null;
    if (typeof draft === 'string') input.value = draft;
}

/** What the edit page's React editor takes over from the code that ran before it arrived. */
export interface AboutDraft {
    /** Resolves when hydrating the textarea can no longer break a composition. */
    settled(): Promise<void>;
    /** Puts the writer's text on the mounted textarea. True when Save was pressed before the editor arrived. */
    handOff(input: HTMLTextAreaElement): boolean;
    release(): void;
}

/** A page opened by navigation mounts its editor directly, so only a saved draft needs restoring. */
export function storedAboutDraft(): AboutDraft {
    return {
        settled: () => Promise.resolve(),
        handOff(input) {
            restoreDraft(input);
            clearDraft();
            return false;
        },
        release() {}
    };
}

/**
 * Protects the server-rendered editor until React takes it over.
 * Hydration rewrites the textarea, which would drop typed text and break a Hangul syllable being composed.
 * Nothing here may leave the markup changed once `settled` resolves, or hydration would not match it.
 */
export function guardAboutDraft(content: Element): AboutDraft | undefined {
    const input = content.querySelector<HTMLTextAreaElement>('[data-about-page] > textarea');
    const save = content.querySelector<HTMLButtonElement>('[data-about-page] > [data-about-save]');
    if (!input || !save) return undefined;

    restoreDraft(input);
    const read = () => ({ value: input.value, start: input.selectionStart, end: input.selectionEnd });
    const saveLabel = save.textContent;
    const guarding = new AbortController();
    let draft = read();
    let composing = false;
    let markupSettled = false;
    let saveRequested = false;
    let afterComposition: (() => void) | undefined;

    const restoreMarkup = () => {
        markupSettled = true;
        save.disabled = false;
        save.textContent = saveLabel;
    };
    // React stops these events at its root while the page is dehydrated, and a key press can make it hydrate
    // during that event, so every listener runs on the window ahead of React.
    const watch = (type: string, listener: (event: Event) => void) =>
        window.addEventListener(type, listener, { capture: true, signal: guarding.signal });
    const record = (event: Event) => {
        if (event.target === input && event instanceof InputEvent && event.isComposing) composing = true;
        if (event.target === input || document.activeElement === input) draft = read();
    };
    for (const type of ['input', 'keydown', 'selectionchange']) watch(type, record);
    watch('compositionstart', (event) => {
        if (event.target === input) composing = true;
    });
    watch('compositionend', (event) => {
        if (event.target !== input) return;
        composing = false;
        // Fast typing ends one syllable and starts the next together.
        window.setTimeout(() => {
            if (composing || guarding.signal.aborted) return;
            afterComposition?.();
            afterComposition = undefined;
        }, 0);
    });
    watch('click', (event) => {
        if (!(event.target instanceof Node) || !save.contains(event.target)) return;
        // The editor sends this save when it mounts, so React must not also handle the click.
        event.stopPropagation();
        if (saveRequested) return;
        saveRequested = true;
        if (markupSettled) return;
        save.disabled = true;
        void activateDocumentLocale().then(
            () => {
                if (!markupSettled) save.textContent = ui('Saving...');
            },
            () => undefined
        );
    });
    document.addEventListener('blex:before-page-change', () => guarding.abort(), {
        once: true,
        signal: guarding.signal
    });

    return {
        settled: () =>
            new Promise((resolve) => {
                afterComposition = () => {
                    restoreMarkup();
                    resolve();
                };
                if (!composing) afterComposition();
            }),
        handOff(hydrated) {
            guarding.abort();
            clearDraft();
            if (hydrated.value !== draft.value) {
                hydrated.value = draft.value;
                hydrated.setSelectionRange(draft.start, draft.end);
            }
            return saveRequested;
        },
        release() {
            guarding.abort();
            restoreMarkup();
        }
    };
}

/**
 * An old chunk can disappear after a deploy, and only a reload finds the new one.
 * The reload happens only once the writer's text is safe in this tab.
 */
export function showAboutLoadError(): void {
    const page = document.querySelector('[data-about-page]');
    const input = page?.querySelector('textarea');
    const message = page?.querySelector<HTMLElement>(':scope > [data-about-message]');
    const save = page?.querySelector<HTMLButtonElement>(':scope > [data-about-save]');
    if (!input || !message || !save) return;

    restoreDraft(input);
    save.disabled = true;
    const leaving = new AbortController();
    document.addEventListener('blex:before-page-change', () => leaving.abort(), { once: true });
    const render = () => {
        const status = document.createElement('span');
        status.textContent = ui('Could not load the editor. Your input is preserved.');
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'ml-2 font-semibold underline';
        retry.textContent = ui('Try again');
        // The page never hydrates, so React would stop a click inside it before the button saw it.
        const listener = (event: Event) => {
            if (!(event.target instanceof Node) || !retry.contains(event.target)) return;
            const unchanged = input.value === input.defaultValue;
            if (unchanged) clearDraft();
            const kept =
                unchanged ||
                withStorage((storage) => {
                    storage.setItem(draftKey(), input.value);
                    return true;
                });
            if (kept) location.reload();
            else
                status.textContent = ui(
                    'Your input could not be preserved, so the page was not refreshed. Copy your content before refreshing.'
                );
        };
        window.addEventListener('click', listener, { capture: true, signal: leaving.signal });
        message.setAttribute('role', 'alert');
        message.classList.add('text-danger');
        message.replaceChildren(status, retry);
        message.hidden = false;
    };
    void activateDocumentLocale().then(render, render);
}
