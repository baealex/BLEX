import type { ComponentType, ReactElement, ReactNode } from 'react';

export type SiteIconName = string;

export interface HeaderViewer {
    username?: string;
    hasEditorRole?: boolean;
    isStaff?: boolean;
    csrfToken?: string;
    unreadCount?: number;
}

export interface SiteHeaderBrand {
    siteName: string;
    logoUrl?: string | null;
    darkLogoUrl?: string | null;
    footerPages?: Array<{ title: string; slug: string }>;
}

export interface SiteHeaderProps {
    brand?: SiteHeaderBrand;
    viewer?: HeaderViewer | null;
    searchPage?: boolean;
    editorPage?: boolean;
    hideAuthLinks?: boolean;
}

export interface LoginModel {
    csrfToken: string;
    next: string;
    providers: Array<{ key: 'google' | 'github'; name: string }>;
    pendingOAuth: { username: string } | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

/** What the server may call from the client's server-rendering bundle. */
export interface ClientViews {
    renderApplicationDocument(page: ReactElement, hydrateContent?: boolean): string;
    renderPage(id: string, props: unknown): string;
    SiteHeader: ComponentType<SiteHeaderProps>;
    SiteFooter: ComponentType<{ brand?: SiteHeaderBrand }>;
    SiteTheme: ComponentType;
    SiteIcon: ComponentType<{ name: SiteIconName; className?: string }>;
    loginPromptProps: (returnTo: string, action: Loose) => Record<string, unknown>;
    AuthorHeader: (props: Loose) => ReactNode;
    PostComments: (props: Loose) => ReactNode;
    ReaderActions: (props: Loose) => ReactElement;
    LoginForm: ComponentType<{ model: Loose }>;
    AuthPanel: ComponentType<Loose>;
    authField: string;
    authInput: string;
    authSubmit: string;
    opensOutsideApplication(response: Pick<Response, 'ok' | 'redirected'>, isApplicationPage: boolean): boolean;
    commentModel: Record<string, (...args: Loose[]) => Loose>;
}
