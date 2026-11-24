import type { Messages } from '@lingui/core';
import { activateLocale, i18n } from '.';
import type { AppLocale } from './locale';

// Public pages load only `public.` messages. These hold the rest, which screens add before they render.
const screenCatalogLoaders: Record<AppLocale, () => Promise<{ messages: Messages }>> = {
    en: () => import('../locales/en/messages.po?lingui'),
    ko: () => import('../locales/ko/messages.po?lingui')
};

// Merging notifies every mounted screen, whose effects may depend on `t`, so each messages object
// is merged into once. Loading a language from elsewhere brings a new object that needs the merge again.
const mergedMessages = new Map<AppLocale, Messages>();

const reportingFailure = <T>(loading: Promise<T>): Promise<T> =>
    loading.catch((error: unknown) => {
        document.dispatchEvent(new Event('blex:catalog-failed'));
        throw error;
    });

/** Loads a language's screen messages without activating it, while the previous page is still shown. */
export const loadScreenCatalog = (locale: AppLocale): Promise<unknown> =>
    reportingFailure(screenCatalogLoaders[locale]());

/** Activates the page's language with every message a screen uses. */
export const activateScreenLocale = (locale: AppLocale): Promise<void> =>
    reportingFailure(
        Promise.all([activateLocale(locale), screenCatalogLoaders[locale]()]).then(([, { messages }]) => {
            if (i18n.locale === locale && i18n.messages === mergedMessages.get(locale)) return;
            i18n.load(locale, messages);
            if (i18n.locale === locale) mergedMessages.set(locale, i18n.messages);
        })
    );
