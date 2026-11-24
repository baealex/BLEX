import type { Messages } from '@lingui/core';
import { activateLocale, i18n } from '.';
import { getDocumentLocale, type AppLocale } from './locale';

// Public pages load only `public.` messages. These hold the rest, which screens add before they render.
const screenCatalogLoaders: Record<AppLocale, () => Promise<{ messages: Messages }>> = {
    en: () => import('../locales/en/messages.po?lingui'),
    ko: () => import('../locales/ko/messages.po?lingui')
};

// Merging notifies every mounted screen, whose effects may depend on `t`, so each messages object
// is merged into once. Loading a language from elsewhere brings a new object that needs the merge again.
const mergedMessages = new Map<AppLocale, Messages>();

/** Activates the document's language with every message a screen uses. */
export const activateScreenLocale = async (): Promise<void> => {
    const locale = getDocumentLocale();
    try {
        const [, { messages }] = await Promise.all([activateLocale(locale), screenCatalogLoaders[locale]()]);
        if (i18n.locale === locale && i18n.messages === mergedMessages.get(locale)) return;
        i18n.load(locale, messages);
        if (i18n.locale === locale) mergedMessages.set(locale, i18n.messages);
    } catch (error) {
        document.dispatchEvent(new Event('blex:catalog-failed'));
        throw error;
    }
};
