export { renderApplicationDocument } from './application/document';
export { opensOutsideApplication } from './application/navigation';
export { SiteIcon } from './appearance/icons';
export { SiteFooter, SiteHeader, SiteTheme } from './appearance/shell';
export { LoginForm } from './features/auth/ui/login-form';
export { AuthPanel, authField, authInput, authSubmit } from './features/auth/ui/panel';
export { AuthorHeader, ReaderActions } from './features/engagement/ui';
export { loginPromptProps } from './features/engagement/ui/login-prompt';
export * as commentModel from './features/engagement/ui/comment-model';

const pages = import.meta.glob<{ default: (props: never) => string }>('./routes/**/*.page.tsx', { eager: true });

/** Renders one server-rendered route. The id is its file path under `routes`. */
export function renderPage(id: string, props: unknown): string {
    const page = pages[`./routes/${id}.page.tsx`];
    if (!page) throw new Error(`Unknown page: ${id}`);
    return page.default(props as never);
}
