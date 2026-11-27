export { renderApplicationDocument } from './application/document';
export { opensOutsideApplication } from './application/navigation';
export { SiteIcon } from './appearance/icons';
export { SiteFooter, SiteHeader, SiteTheme, setSiteStylesheets } from './appearance/shell';
export { LoginForm } from './features/auth/ui/login-form';
export { AuthPanel, authField, authInput, authSubmit } from './features/auth/ui/panel';
export { AuthorHeader, ReaderActions } from './features/engagement/ui';
export { loginPromptProps } from './features/engagement/ui/login-prompt';
export * as commentModel from './features/engagement/ui/comment-model';
import { i18n } from '@lingui/core';
import { messages as englishMessages } from './locales/en/messages.po';
import { messages as koreanMessages } from './locales/ko/messages.po';
import { normalizeLocale, withDocumentLocale } from './i18n/locale';
import { withReturnPath } from './application/document';

i18n.load({ en: englishMessages, ko: koreanMessages });
i18n.activate('ko');

const pages = import.meta.glob<{ default: (props: never) => string }>('./routes/**/*.page.tsx', { eager: true });

/**
 * Renders one server-rendered route. The id is its file path under `routes`, and `returnPath` is the page's own
 * path as the sign-in page accepts it for `next`.
 */
export function renderPage(id: string, props: unknown, locale = 'ko', returnPath?: string): string {
    const page = pages[`./routes/${id}.page.tsx`];
    if (!page) throw new Error(`Unknown page: ${id}`);
    const language = normalizeLocale(locale);
    const previous = i18n.locale;
    return withDocumentLocale(language, () => {
        i18n.activate(language);
        try {
            return withReturnPath(returnPath, () => page.default(props as never));
        } finally {
            i18n.activate(previous);
        }
    });
}
