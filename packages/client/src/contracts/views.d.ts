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
    locale?: 'ko' | 'en';
}

export interface LoginModel {
    csrfToken: string;
    next: string;
    providers: Array<{ key: 'google' | 'github'; name: string }>;
    pendingOAuth: { username: string } | null;
}
