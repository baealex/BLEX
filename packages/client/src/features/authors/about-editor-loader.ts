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
    status.textContent = '편집기를 불러오지 못했습니다. 입력한 내용은 그대로 있습니다.';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'ml-2 font-semibold underline';
    retry.textContent = '다시 시도';
    retry.addEventListener(
        'click',
        () => {
            const unchanged = input.value === input.defaultValue;
            if (unchanged) clearDraft();
            if (unchanged || keepDraft(input.value)) {
                location.reload();
                return;
            }
            status.textContent =
                '입력한 내용을 보관할 수 없어 새로고침하지 않았습니다. 내용을 복사한 뒤 새로고침해 주세요.';
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

export function loadAboutEditors(signal: AbortSignal): void {
    if (!document.querySelector('[data-about-page], [data-about-editor]')) return;
    const page = document.querySelector<HTMLElement>('[data-about-page]');
    const input = page?.querySelector<HTMLTextAreaElement>('[data-about-input]');
    if (input && input.value === input.defaultValue) {
        const draft = readDraft();
        if (draft !== null) input.value = draft;
    }
    void import('./about-editor-client').then(
        ({ mountAboutEditors }) => {
            if (signal.aborted) return;
            mountAboutEditors(signal);
            if (input) clearDraft();
        },
        () => {
            // Without the edit page, the profile's edit links still lead there.
            if (!signal.aborted && page && input) showLoadError(page, input, signal);
        }
    );
}
