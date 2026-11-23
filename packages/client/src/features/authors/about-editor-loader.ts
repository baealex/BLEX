import { ui } from '../../i18n/public-ui.js';
const draftKey = () => `blex:about-draft:${location.pathname}`;

function readDraft(): string | null {
    try {
        return sessionStorage.getItem(draftKey());
    } catch {
        return null;
    }
}

function clearDraft(): void {
    try {
        sessionStorage.removeItem(draftKey());
    } catch {
        /* Nothing was kept when browser storage is unavailable. */
    }
}

function keepDraft(value: string): boolean {
    try {
        sessionStorage.setItem(draftKey(), value);
        return true;
    } catch {
        return false;
    }
}

/**
 * An old chunk can disappear after a deploy, and only a reload finds the new one.
 * The reload happens only once the writer's text is safe in this tab.
 */
function showLoadError(page: HTMLElement, input: HTMLTextAreaElement, signal: AbortSignal): void {
    const message = page.querySelector<HTMLElement>('[data-about-message]');
    const save = page.querySelector<HTMLButtonElement>('[data-about-save]');
    if (!message || !save) return;

    const status = document.createElement('span');
    status.textContent = ui('Could not load the editor. Your input is preserved.');
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'ml-2 font-semibold underline';
    retry.textContent = ui('Try again');
    retry.addEventListener(
        'click',
        () => {
            const unchanged = input.value === input.defaultValue;
            if (unchanged) clearDraft();
            if (unchanged || keepDraft(input.value)) {
                location.reload();
                return;
            }
            status.textContent = ui(
                'Your input could not be preserved, so the page was not refreshed. Copy your content before refreshing.'
            );
        },
        { signal }
    );

    save.disabled = true;
    message.setAttribute('role', 'alert');
    message.classList.add('text-danger');
    message.replaceChildren(status, retry);
    message.hidden = false;
    // A page with identical HTML keeps this DOM, and the next island must find the server markup.
    signal.addEventListener(
        'abort',
        () => {
            save.disabled = false;
            message.removeAttribute('role');
            message.classList.remove('text-danger');
            message.replaceChildren();
            message.hidden = true;
        },
        { once: true }
    );
}

/**
 * Hydration rewrites the textarea, which would break a Hangul syllable still being composed.
 * Once it starts outside a composition, the next key press hydrates before the IME begins a new one.
 */
function outsideComposition(input: HTMLTextAreaElement | null | undefined, signal: AbortSignal) {
    let composing = false;
    let pending: (() => void) | undefined;
    input?.addEventListener(
        'compositionstart',
        () => {
            composing = true;
        },
        { signal }
    );
    input?.addEventListener(
        'input',
        (event) => {
            if (event instanceof InputEvent && event.isComposing) composing = true;
        },
        { signal }
    );
    input?.addEventListener(
        'compositionend',
        () => {
            composing = false;
            // Fast typing ends one syllable and starts the next together.
            window.setTimeout(() => {
                if (composing || signal.aborted) return;
                pending?.();
                pending = undefined;
            }, 0);
        },
        { signal }
    );
    return (run: () => void) => {
        if (composing) pending = run;
        else run();
    };
}

export function loadAboutEditors(signal: AbortSignal): void {
    if (!document.querySelector('[data-about-page], [data-about-editor]')) return;
    const page = document.querySelector<HTMLElement>('[data-about-page]');
    const input = page?.querySelector<HTMLTextAreaElement>('[data-about-input]');
    if (input && input.value === input.defaultValue) {
        const draft = readDraft();
        if (draft !== null) input.value = draft;
    }
    const whenSafe = outsideComposition(input, signal);
    void import('./about-editor-client').then(
        ({ mountAboutEditors }) => {
            whenSafe(() => {
                if (signal.aborted) return;
                mountAboutEditors(signal);
                if (input) clearDraft();
            });
        },
        () => {
            // Without the edit page, the profile's edit links still lead there.
            if (!signal.aborted && page && input) showLoadError(page, input, signal);
        }
    );
}
