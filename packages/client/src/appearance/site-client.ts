import { ui } from '../i18n/public-ui.js';
import { activateDocumentLocale } from '../i18n';
import { reloadAfterCatalogFailure } from './catalog-recovery';
import { siteText } from './messages.js';
import './tailwind.css';
import './site.scss';
import { escapeAction } from './quick-search-escape';
import { rememberSearch } from './recent-searches';
import { THEME_COOKIE_KEY, writeThemePreferenceCookie } from './theme-cookie';

const root = document.documentElement;
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
const themeButtons = new WeakSet<HTMLButtonElement>();

let routeController: AbortController | undefined;
let routeGeneration = 0;
let hydrated = !document.getElementById('blex-application');
let clientBindingsInstalled = false;

function readCookie(key: string): string {
    const value = document.cookie.split('; ').find((entry) => entry.startsWith(`${key}=`));
    try {
        return value ? decodeURIComponent(value.slice(key.length + 1)) : '';
    } catch {
        return '';
    }
}

function setTheme(preference = readCookie(THEME_COOKIE_KEY), updateControls = hydrated) {
    const mode = preference === 'dark' || preference === 'light' ? preference : 'system';
    const dark = mode === 'dark' || (mode === 'system' && systemTheme.matches);
    const theme = dark ? 'dark' : 'light';
    const changed = root.dataset.theme !== theme;
    root.dataset.theme = theme;
    root.dataset.themePreference = mode;
    root.style.colorScheme = theme;
    if (updateControls) {
        for (const button of document.querySelectorAll<HTMLButtonElement>('[data-site-theme-toggle]')) {
            const label = siteText(
                root.lang === 'en' ? 'en' : 'ko',
                dark ? 'Switch to light mode' : 'Switch to dark mode'
            );
            button.setAttribute('aria-label', label);
            button.title = label;
        }
    }
    if (changed) window.dispatchEvent(new CustomEvent('blex:theme-change', { detail: { theme } }));
}

function disposeRouteBindings() {
    routeController?.abort();
    routeController = undefined;
}

function closeTransientUi() {
    for (const menu of document.querySelectorAll<HTMLDialogElement>('#blex-mobile-menu')) {
        if (menu.open) menu.close();
    }
    for (const toggle of document.querySelectorAll<HTMLButtonElement>('[data-site-menu-open]')) {
        toggle.setAttribute('aria-expanded', 'false');
    }
    for (const details of document.querySelectorAll<HTMLDetailsElement>('[data-account-menu]')) details.open = false;
    for (const dialog of document.querySelectorAll<HTMLDialogElement>('dialog[open]')) {
        if (dialog.open) dialog.close();
    }
}

function bindThemeButtons() {
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-site-theme-toggle]')) {
        if (themeButtons.has(button)) continue;
        themeButtons.add(button);
        button.addEventListener('click', () => {
            const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
            writeThemePreferenceCookie(next);
            setTheme(next);
        });
    }
}

function updateHeader() {
    const header = document.querySelector<HTMLElement>('[data-site-header]');
    if (!header) return;
    header.classList.toggle('border-line-light', scrollY > 0);
    header.classList.toggle('border-transparent', scrollY === 0);
}

/**
 * Outside the application frame, React for the search box loads only once the reader reaches for it.
 * These listeners cover the box until the island takes over, and the plain form keeps working if it never does.
 */
function bindStandaloneSearch(signal: AbortSignal) {
    const search = document.querySelector<HTMLElement>('[data-site-search]');
    const form = search?.querySelector('form');
    const input = search?.querySelector('input');
    if (!search || !form || !input) return;
    const untilMounted = new AbortController();
    const listening = { signal: untilMounted.signal };
    signal.addEventListener('abort', () => untilMounted.abort(), { once: true, ...listening });
    let loading = false;
    let dismissed = false;
    const load = () => {
        if (loading) return;
        loading = true;
        void import('./quick-search-client').then(
            ({ mountQuickSearch }) => {
                if (!signal.aborted)
                    mountQuickSearch(
                        search,
                        signal,
                        () => untilMounted.abort(),
                        () => dismissed
                    );
            },
            () => {
                loading = false;
            }
        );
    };
    const engage = () => {
        dismissed = false;
        load();
    };
    input.addEventListener('focus', engage, listening);
    input.addEventListener('input', engage, listening);
    input.addEventListener(
        'keydown',
        (event) => {
            if (event.key !== 'Escape') return;
            const action = escapeAction(event, false, input.value !== '');
            if (action !== 'none') event.preventDefault();
            if (action === 'clear') input.value = '';
            if (action !== 'hold') dismissed = true;
        },
        listening
    );
    form.addEventListener('submit', () => rememberSearch(input.value.trim()), listening);
    document.addEventListener(
        'keydown',
        (event) => {
            if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
            if (!search.getClientRects().length) return;
            event.preventDefault();
            input.focus();
            load();
        },
        listening
    );
    if (document.activeElement === input) load();
}

function bindRouteElements() {
    disposeRouteBindings();
    const controller = new AbortController();
    routeController = controller;
    const { signal } = controller;

    for (const form of document.querySelectorAll<HTMLFormElement>('[data-settings-brand-upload]')) {
        const input = form.querySelector<HTMLInputElement>('input[type="file"]');
        input?.addEventListener(
            'change',
            () => {
                if (input.files?.length) form.requestSubmit();
            },
            { signal }
        );
    }

    for (const input of document.querySelectorAll<HTMLInputElement>('[data-work-log-attachment]')) {
        const filename = input.parentElement?.querySelector<HTMLElement>('[data-work-log-filename]');
        input.addEventListener(
            'change',
            () => {
                if (filename) filename.textContent = input.files?.[0]?.name ?? '';
            },
            { signal }
        );
    }

    for (const box of document.querySelectorAll<HTMLElement>('[data-work-log-share-link]')) {
        const link = box.querySelector<HTMLInputElement>('input');
        const button = box.querySelector<HTMLButtonElement>('[data-work-log-copy]');
        const status = box.querySelector<HTMLElement>('[data-work-log-copied]');
        link?.addEventListener('focus', () => link.select(), { signal });
        button?.addEventListener(
            'click',
            () => {
                link?.select();
                void navigator.clipboard
                    ?.writeText(link?.value ?? '')
                    .then(() => {
                        button.textContent = ui('Link copied');
                        if (status) status.textContent = ui('Link copied');
                    })
                    .catch(() => undefined);
            },
            { signal }
        );
    }

    const mobileMenu = document.querySelector<HTMLDialogElement>('#blex-mobile-menu');
    mobileMenu?.addEventListener(
        'close',
        () => {
            document.querySelector<HTMLButtonElement>('[data-site-menu-open]')?.setAttribute('aria-expanded', 'false');
        },
        { signal }
    );

    const siteSettingsForm = document.querySelector<HTMLFormElement>('[data-site-settings-form]');
    const siteSettingsSave = document.querySelector<HTMLButtonElement>('[data-site-settings-save]');
    if (siteSettingsForm && siteSettingsSave) {
        const fields = [...siteSettingsForm.elements].filter(
            (field): field is HTMLInputElement | HTMLTextAreaElement =>
                field instanceof HTMLTextAreaElement || (field instanceof HTMLInputElement && field.type !== 'hidden')
        );
        const updateSave = () => {
            siteSettingsSave.disabled = fields.every((field) => field.value === field.defaultValue);
        };
        for (const field of fields) field.addEventListener('input', updateSave, { signal });
        updateSave();
    }

    for (const details of document.querySelectorAll<HTMLDetailsElement>('[data-comment-edit]')) {
        const id = details.dataset.commentEdit ?? '';
        const field = details.querySelector<HTMLTextAreaElement>('textarea');
        const submit = details.querySelector<HTMLButtonElement>('button[type=submit]');
        const status = details.querySelector<HTMLElement>('[data-comment-edit-status]');
        if (!/^\d+$/.test(id) || !field || !submit || !status) continue;
        let loaded = false;
        let loading = false;
        async function openEditor() {
            if (signal.aborted || !field || !submit || !status || loaded || loading) return;
            loading = true;
            status.textContent = ui('Loading comments.');
            try {
                const response = await fetch(`/v1/comments/${id}`, {
                    cache: 'no-store',
                    signal
                });
                const result = await response.json();
                if (!response.ok || typeof result.body?.textMd !== 'string') throw new Error('Comment unavailable');
                if (signal.aborted || !field.isConnected) return;
                field.value = result.body.textMd;
                field.disabled = submit.disabled = false;
                status.textContent = '';
                loaded = true;
                if (details.open) field.focus();
            } catch {
                if (!signal.aborted && status.isConnected)
                    status.textContent = ui('Could not load comments. Open them again.');
            } finally {
                loading = false;
            }
        }
        details.querySelector('summary')?.addEventListener(
            'click',
            () => {
                if (!details.open) void openEditor();
            },
            { signal }
        );
        details.addEventListener(
            'toggle',
            () => {
                if (details.open) void openEditor();
            },
            { signal }
        );
    }

    for (const form of document.querySelectorAll<HTMLFormElement>('[data-site-logout]')) {
        form.addEventListener(
            'submit',
            (event) => {
                const field = form.elements.namedItem('csrfmiddlewaretoken');
                if (!(field instanceof HTMLInputElement)) return;
                field.value ||= readCookie('csrftoken');
                if (field.value) return;
                event.preventDefault();
                void fetch('/v1/login', { credentials: 'same-origin' })
                    .then(() => {
                        if (!form.isConnected || signal.aborted) return;
                        field.value = readCookie('csrftoken');
                        if (field.value) form.requestSubmit();
                    })
                    .catch(() => undefined);
            },
            { signal }
        );
    }

    if (!document.getElementById('blex-application')) bindStandaloneSearch(signal);
    if (document.querySelector('[data-heatmap-days]')) {
        void import('./author-heatmap.js').then(({ mountAuthorHeatmaps }) => {
            if (!signal.aborted) mountAuthorHeatmaps(signal);
        });
    }
    // A mounted post page shows this prompt from its own tree, and reports when it could not mount.
    if (!document.querySelector('[data-blex-post-page]')) offerTelegramHint(signal);
}

function offerTelegramHint(signal: AbortSignal) {
    if (!/(?:^|; )blex_telegram_hint=/.test(document.cookie)) return;
    // The prompt is optional, and its cookie stays so the next page can try again.
    void import('../features/engagement/ui/telegram-hint').then(
        ({ showTelegramHint }) => {
            if (!signal.aborted) showTelegramHint(signal);
        },
        () => undefined
    );
}

function handleGlobalClick(event: MouseEvent) {
    if (!(event.target instanceof Element)) return;
    const target = event.target;

    if (target.closest('[data-history-back]')) {
        if (history.length > 1) history.back();
        else location.href = '/';
    }

    const menuToggle = target.closest<HTMLButtonElement>('[data-site-menu-open]');
    if (menuToggle) {
        const menu = document.querySelector<HTMLDialogElement>('#blex-mobile-menu');
        if (menu && !menu.open) {
            menu.showModal();
            menuToggle.setAttribute('aria-expanded', 'true');
        }
    }

    const dialogButton = target.closest<HTMLButtonElement>('[data-open-dialog]');
    if (dialogButton) {
        const dialog = document.getElementById(dialogButton.dataset.openDialog ?? '');
        if (dialog instanceof HTMLDialogElement && !dialog.open) dialog.showModal();
    }

    const dialog = target instanceof HTMLDialogElement ? target : target.closest('dialog');
    if (dialog instanceof HTMLDialogElement && (target === dialog || target.closest('a[href^="#"]'))) dialog.close();

    const copiedButton = target.closest<HTMLElement>('[data-copy-link]');
    if (copiedButton) {
        const generation = routeGeneration;
        const status = copiedButton.parentElement?.querySelector<HTMLElement>('[data-copy-status]');
        void (async () => {
            try {
                await navigator.clipboard.writeText(copiedButton.dataset.copyLink ?? '');
                if (generation === routeGeneration && copiedButton.isConnected && status?.isConnected)
                    status.textContent = copiedButton.dataset.copyMessage ?? ui('Link copied.');
            } catch {
                if (generation === routeGeneration && copiedButton.isConnected && status?.isConnected)
                    status.textContent = copiedButton.dataset.copyErrorMessage ?? ui('Could not copy.');
            }
        })();
    }

    for (const details of document.querySelectorAll<HTMLDetailsElement>('[data-account-menu]')) {
        if (!details.contains(target)) details.open = false;
    }
}

function handleGlobalKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    for (const details of document.querySelectorAll<HTMLDetailsElement>('[data-account-menu]')) details.open = false;
}

function handleBeforePageChange() {
    routeGeneration += 1;
    if (!hydrated) return;
    disposeRouteBindings();
    closeTransientUi();
}

function handlePageChange() {
    routeGeneration += 1;
    if (hydrated) {
        disposeRouteBindings();
        closeTransientUi();
    } else {
        hydrated = true;
    }
    activateClientBindings();
}

function activateClientBindings() {
    if (!clientBindingsInstalled) {
        clientBindingsInstalled = true;
        window.addEventListener('scroll', updateHeader, { passive: true });
        document.addEventListener('click', handleGlobalClick);
        document.addEventListener('keydown', handleGlobalKeydown);
    }
    bindThemeButtons();
    setTheme();
    updateHeader();
    bindRouteElements();
}

systemTheme.addEventListener('change', () => setTheme(undefined, hydrated && localeReady));
document.addEventListener('blex:before-page-change', handleBeforePageChange);
document.addEventListener('blex:page-change', handlePageChange);
document.addEventListener('blex:catalog-failed', reloadAfterCatalogFailure);
document.addEventListener('blex:post-page-unmounted', () => {
    if (routeController) offerTelegramHint(routeController.signal);
});

let localeReady = false;
setTheme(undefined, false);
void activateDocumentLocale()
    .then(() => {
        localeReady = true;
        if (hydrated) activateClientBindings();
    })
    .catch((error: unknown) => {
        console.error('BLEX could not load the site controls.', error);
    });
