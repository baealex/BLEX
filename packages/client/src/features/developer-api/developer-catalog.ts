import type { Messages } from '@lingui/core';
import { i18n, loadCatalog, type AppLocale } from '../../i18n';

// The guide's `developer.` messages form a catalog part of their own, so other public pages never download them.
const catalogLoaders: Record<AppLocale, () => Promise<{ messages: Messages }>> = {
    en: () => import('../../locales/en/messages.po?developer?lingui'),
    ko: () => import('../../locales/ko/messages.po?developer?lingui')
};

/**
 * Adds the guide's messages to the guide's language, which a navigation may activate only after this.
 * They go into the language's public catalog object, which activation installs, so they stay either way.
 */
export async function loadDeveloperMessages(locale: AppLocale): Promise<void> {
    const part = catalogLoaders[locale]().catch((error: unknown) => {
        document.dispatchEvent(new Event('blex:catalog-failed'));
        throw error;
    });
    const [catalog, { messages }] = await Promise.all([loadCatalog(locale), part]);
    Object.assign(catalog.messages, messages);
    if (i18n.locale === locale) i18n.load(locale, messages);
}
