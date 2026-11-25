import { ui } from '../i18n/public-ui.js';
import { activateDocumentLocale } from '../i18n';
import { removeSignedInCaches } from '../lib/query-cache-key';
import { removeSignedInDrafts } from '../lib/signed-in-drafts';
import { reloadAfterCatalogFailure } from './catalog-recovery';
import { escapeAction } from './quick-search-escape.js';
import './tailwind.css';
import './site.scss';
import { THEME_COOKIE_KEY, writeThemePreferenceCookie } from './theme-cookie';

const root = document.documentElement;
const systemTheme = matchMedia('(prefers-color-scheme: dark)');

let routeController: AbortController | undefined;
let routeGeneration = 0;
let hydrated = !document.getElementById('blex-application');
let clientBindingsInstalled = false;
let signingOut = false;
// This script answers Esc and Cmd/Ctrl+K in the header's search box, before and after the box hydrates.
// Focusing the box opens its panel once it hydrates, so before that Esc treats the panel as open unless
// Esc already closed it, and typing or focusing opens it again.
let searchHydrated = false;
let searchClosed = false;
const searchInput = '[data-site-search] input';

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
            const label = dark ? ui('Switch to light mode') : ui('Switch to dark mode');
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

function updateHeader() {
    const header = document.querySelector<HTMLElement>('[data-site-header]');
    if (!header) return;
    header.classList.toggle('border-line-light', scrollY > 0);
    header.classList.toggle('border-transparent', scrollY === 0);
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

    if (document.querySelector('[data-heatmap-days]')) {
        void import('./author-heatmap.js').then(({ mountAuthorHeatmaps }) => {
            if (!signal.aborted) mountAuthorHeatmaps(signal);
        });
    }
}

async function copyLink(button: HTMLElement, generation: number) {
    const status = button.parentElement?.querySelector<HTMLElement>('[data-copy-status]');
    let copied = true;
    try {
        await navigator.clipboard.writeText(button.dataset.copyLink ?? '');
    } catch {
        copied = false;
    }
    try {
        // The status is translated, and a click before the page hydrates can come before its translations.
        await activateDocumentLocale();
    } catch {
        return;
    }
    if (generation !== routeGeneration || !button.isConnected || !status?.isConnected) return;
    status.textContent = copied
        ? (button.dataset.copyMessage ?? ui('Link copied.'))
        : (button.dataset.copyErrorMessage ?? ui('Could not copy.'));
}

function handleGlobalClick(event: MouseEvent) {
    if (!(event.target instanceof Element)) return;
    const target = event.target;

    if (target.closest('[data-site-theme-toggle]')) {
        const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
        writeThemePreferenceCookie(next);
        setTheme(next);
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
    // A page with unsaved edits asks before a menu link leaves it, and the open menu would block that question.
    const leavesMenu = dialog?.id === 'blex-mobile-menu' && target.closest('a[href]');
    if (dialog instanceof HTMLDialogElement && (target === dialog || target.closest('a[href^="#"]') || leavesMenu))
        dialog.close();

    const copiedButton = target.closest<HTMLElement>('[data-copy-link]');
    if (copiedButton) void copyLink(copiedButton, routeGeneration);

    for (const details of document.querySelectorAll<HTMLDetailsElement>('[data-account-menu]')) {
        if (!details.contains(target)) details.open = false;
    }
}

function answerSearchKey(event: KeyboardEvent) {
    const input = document.querySelector<HTMLInputElement>(searchInput);
    if (!input) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        // Narrow screens hide the box and link to the search page instead.
        if (!input.getClientRects().length) return;
        event.preventDefault();
        input.focus();
    } else if (event.key === 'Escape' && event.target === input) {
        const open = searchHydrated
            ? !document.querySelector<HTMLElement>('[data-site-search-panel]')?.hidden
            : !searchClosed;
        const action = escapeAction(event, open, input.value !== '');
        if (action !== 'none') event.preventDefault();
        if (action === 'close') searchClosed = true;
        if (action === 'clear') input.value = '';
        // The box stops looking for results and closes its panel.
        if (action === 'close' || action === 'clear') document.dispatchEvent(new Event('blex:quick-search-close'));
    }
}

function handleGlobalKeydown(event: KeyboardEvent) {
    answerSearchKey(event);
    if (event.key !== 'Escape') return;
    for (const details of document.querySelectorAll<HTMLDetailsElement>('[data-account-menu]')) details.open = false;
}

function reopenSearch(event: Event) {
    if (event.target instanceof Element && event.target.matches(searchInput)) searchClosed = false;
}

function handleDialogClose(event: Event) {
    if (event.target instanceof HTMLDialogElement && event.target.id === 'blex-mobile-menu')
        document.querySelector<HTMLButtonElement>('[data-site-menu-open]')?.setAttribute('aria-expanded', 'false');
}

function removeSignedInData() {
    removeSignedInCaches();
    removeSignedInDrafts();
}

/**
 * A viewer's screens keep their queries and unsaved edits in browser storage, so they go when the viewer signs out.
 * The sign-out form can post natively or through the application, and an open screen can still save them
 * until the page that follows replaces it, so they go again when that page shows or this document is left.
 */
function signOut() {
    signingOut = true;
    removeSignedInData();
    // Added now, this runs after the open screens' own pagehide listeners, which save unsaved edits.
    window.addEventListener('pagehide', removeSignedInData);
}

function handleSubmit(event: SubmitEvent) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.matches('[data-site-logout]')) return;
    // Public pages leave the token out of the form, so it comes from the cookie, also before the page hydrates.
    const field = form.elements.namedItem('csrfmiddlewaretoken');
    if (field instanceof HTMLInputElement) field.value ||= readCookie('csrftoken');
    if (field instanceof HTMLInputElement && !field.value) {
        event.preventDefault();
        const generation = routeGeneration;
        void fetch('/v1/login', { credentials: 'same-origin' })
            .then(() => {
                field.value = readCookie('csrftoken');
                if (field.value && form.isConnected && generation === routeGeneration) form.requestSubmit();
            })
            .catch(() => undefined);
        return;
    }
    signOut();
}

function handleBeforePageChange() {
    routeGeneration += 1;
    if (!hydrated) return;
    disposeRouteBindings();
    closeTransientUi();
}

function handlePageChange() {
    // A page that still offers the sign-out form belongs to a viewer who has not signed out yet.
    if (signingOut && !document.querySelector('[data-site-logout]')) {
        signingOut = false;
        window.removeEventListener('pagehide', removeSignedInData);
        removeSignedInData();
    }
    if (hydrated) {
        routeGeneration += 1;
        disposeRouteBindings();
        closeTransientUi();
    } else {
        // Hydration keeps the page, so a menu or a copy status from before it stays.
        hydrated = true;
    }
    activateClientBindings();
}

function activateClientBindings() {
    if (!clientBindingsInstalled) {
        clientBindingsInstalled = true;
        window.addEventListener('scroll', updateHeader, { passive: true });
    }
    setTheme();
    updateHeader();
    bindRouteElements();
}

// These run before the application hydrates, and in the capture phase because React stops
// events inside a page whose code has not arrived yet. The menu's close event does not bubble.
document.addEventListener('click', handleGlobalClick, true);
document.addEventListener('keydown', handleGlobalKeydown, true);
document.addEventListener('close', handleDialogClose, true);
document.addEventListener('submit', handleSubmit, true);
// Deleting an account signs its viewer out as well.
document.addEventListener('blex:sign-out', signOut);
document.addEventListener('focusin', reopenSearch, true);
document.addEventListener('input', reopenSearch, true);
document.addEventListener(
    'blex:quick-search-ready',
    (event) => {
        searchHydrated = true;
        if (searchClosed) event.preventDefault();
    },
    { once: true }
);
systemTheme.addEventListener('change', () => setTheme(undefined, hydrated && localeReady));
document.addEventListener('blex:before-page-change', handleBeforePageChange);
document.addEventListener('blex:page-change', handlePageChange);
document.addEventListener('blex:catalog-failed', reloadAfterCatalogFailure);

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
