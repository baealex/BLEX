import type { Messages } from '@lingui/core';
import { activateDocumentLocale, getDocumentLocale, i18n, type AppLocale } from '../../i18n';

// The guide's `developer.` messages form a catalog part of their own, so other public pages never download them.
const catalogLoaders: Record<AppLocale, () => Promise<{ messages: Messages }>> = {
    en: () => import('../../locales/en/messages.po?developer?lingui'),
    ko: () => import('../../locales/ko/messages.po?developer?lingui')
};

/** Adds the guide's messages to the page's language, after its public messages are active. */
export function loadDeveloperMessages(): Promise<void> {
    const locale = getDocumentLocale();
    const part = catalogLoaders[locale]().catch((error: unknown) => {
        document.dispatchEvent(new Event('blex:catalog-failed'));
        throw error;
    });
    return Promise.all([activateDocumentLocale(), part]).then(([, { messages }]) => i18n.load(locale, messages));
}
