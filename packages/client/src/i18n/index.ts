import { i18n, type Messages } from '@lingui/core';
import { getDocumentLocale, type AppLocale } from './locale';

interface CatalogModule {
    messages: Messages;
}

const catalogLoaders: Record<AppLocale, () => Promise<CatalogModule>> = {
    en: () => import('../locales/en/messages.po'),
    ko: () => import('../locales/ko/messages.po')
};

const catalogPromises = new Map<AppLocale, Promise<CatalogModule>>();

const loadCatalog = (locale: AppLocale): Promise<CatalogModule> => {
    const existing = catalogPromises.get(locale);
    if (existing) {
        return existing;
    }

    const pending = catalogLoaders[locale]();
    catalogPromises.set(locale, pending);
    return pending;
};

export const activateLocale = async (locale: AppLocale): Promise<AppLocale> => {
    if (i18n.locale === locale && Object.keys(i18n.messages).length > 0) {
        return locale;
    }

    const { messages } = await loadCatalog(locale);
    i18n.loadAndActivate({
        locale,
        messages
    });
    return locale;
};

let documentLocaleActivation: Promise<AppLocale> | undefined;

export const activateDocumentLocale = (): Promise<AppLocale> => {
    documentLocaleActivation ??= activateLocale(getDocumentLocale());
    return documentLocaleActivation;
};

export { i18n };
export * from './locale';
