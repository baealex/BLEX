import { ui } from '../i18n/public-ui.js';
import { SiteIcon, type SiteIconName } from './icons.js';
import { QuickSearch } from './quick-search.js';

export { SiteIcon };

export const siteStyleHref = '/assets/blex/theme.css';

interface Brand {
    siteName: string;
    logoUrl?: string | null;
    darkLogoUrl?: string | null;
    footerPages?: Array<{ title: string; slug: string }>;
}

export interface HeaderViewer {
    username?: string;
    hasEditorRole?: boolean;
    isStaff?: boolean;
    csrfToken?: string;
    unreadCount?: number;
}

export function SiteTheme() {
    return (
        <>
            <link rel="stylesheet" href={siteStyleHref} data-blex-theme="" />
            <script type="module" src="/assets/blex/theme.js" />
        </>
    );
}

function SiteLogo({ brand, small }: { brand?: Brand; small?: boolean }) {
    const size = small ? 'h-6 w-auto' : 'h-6 w-auto md:h-7';
    const light = brand?.logoUrl ?? '/resources/logob.svg';
    const dark = brand?.darkLogoUrl ?? (brand?.logoUrl ? light : '/resources/logow.svg');
    const alt = brand?.siteName ?? 'BLEX';
    return (
        <a href="/" className="group flex shrink-0 items-center" aria-label={alt}>
            <img
                src={light}
                alt=""
                className={`blex-site-logo-light ${size} transition-opacity duration-150 group-hover:opacity-70`}
                data-no-filter=""
            />
            <img
                src={dark}
                alt=""
                className={`blex-site-logo-dark ${size} transition-opacity duration-150 group-hover:opacity-70`}
                data-no-filter=""
            />
        </a>
    );
}

const iconButton =
    'inline-flex size-11 items-center justify-center rounded-full text-content-secondary transition-all duration-150 hover:bg-surface-subtle hover:text-content active:scale-95 md:size-10';
const authLink =
    'inline-flex min-h-9 shrink-0 items-center rounded-full px-4 py-2 text-sm font-medium transition-all duration-150 active:scale-95';

function ThemeButton({ bordered }: { bordered?: boolean }) {
    return (
        <button
            type="button"
            data-site-theme-toggle
            className={`${iconButton} ${bordered ? 'border border-line-light' : ''}`}
            aria-label={ui('Switch to dark mode')}
        >
            <SiteIcon name="sun" className="blex-theme-sun size-4" />
            <SiteIcon name="moon" className="blex-theme-moon size-4" />
        </button>
    );
}

const mobileItem =
    'flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors duration-150 hover:bg-surface-subtle active:bg-surface-subtle';

function AccountLinks({ viewer, mobile, newPost }: { viewer: HeaderViewer; mobile?: boolean; newPost?: boolean }) {
    const links: Array<[string, string, SiteIconName]> = [
        ['/work-logs/', ui('Work logs'), 'book'],
        [viewer.username ? `/@${encodeURIComponent(viewer.username)}` : '/settings/profile', ui('Profile'), 'user'],
        ['/settings/notify', ui('Settings'), 'settings']
    ];
    const spacing = mobile ? 'rounded-lg px-3' : 'px-4';
    const iconWidth = mobile ? 'w-5' : 'w-4';
    return (
        <>
            <div className={mobile ? 'border-t border-line-light py-1' : 'py-1'}>
                {newPost && (
                    <a href="/write" className={`${mobileItem} font-medium text-content`}>
                        <SiteIcon name="pencil" className="w-5 text-xs text-content-secondary" />
                        <span>{ui('New post')}</span>
                    </a>
                )}
                {links.map(([href, label, icon]) => (
                    <a
                        key={href}
                        href={href}
                        className={`flex items-center gap-3 ${spacing} py-3 text-sm text-content-secondary transition-colors duration-150 hover:bg-surface-subtle`}
                    >
                        <SiteIcon name={icon} className={`${iconWidth} text-xs text-content-hint`} />
                        <span>{label}</span>
                    </a>
                ))}
            </div>
            <form method="post" action="/logout" className="border-t border-line-light py-1" data-site-logout>
                <input type="hidden" name="csrfmiddlewaretoken" value={viewer.csrfToken ?? ''} />
                <button
                    type="submit"
                    className={`flex w-full items-center gap-3 ${spacing} py-3 text-left text-sm text-danger transition-colors duration-150 hover:bg-danger-surface`}
                >
                    <SiteIcon name="logout" className={`${iconWidth} text-xs`} />
                    <span>{ui('Log out')}</span>
                </button>
            </form>
        </>
    );
}

export interface SiteHeaderProps {
    brand?: Brand;
    viewer?: HeaderViewer | null;
    searchPage?: boolean;
    editorPage?: boolean;
    hideAuthLinks?: boolean;
    /** The page the sign-in links return to, which the server already checked as the sign-in page checks `next`. */
    returnPath?: string;
}

export function SiteHeader({ brand, viewer, searchPage, editorPage, hideAuthLinks, returnPath }: SiteHeaderProps) {
    const loginHref = returnPath ? `/login?next=${encodeURIComponent(returnPath)}` : '/login';
    return (
        <header
            className="frosted-surface sticky top-0 right-0 left-0 z-30 border-b border-transparent transition-all duration-200"
            data-site-header
        >
            <div className="mx-auto max-w-7xl px-4 md:px-6">
                <div className="flex h-14 items-center md:h-16">
                    <SiteLogo brand={brand} />
                    <div className={`flex-1 ${searchPage ? '' : 'md:px-6'}`}>
                        {!searchPage && (
                            <div className="hidden md:block">
                                <QuickSearch />
                            </div>
                        )}
                    </div>
                    <nav className="hidden shrink-0 items-center gap-2 md:flex" aria-label={ui('Account menu')}>
                        <ThemeButton bordered />
                        {viewer ? (
                            <>
                                {viewer.hasEditorRole && !editorPage && (
                                    <a
                                        href="/write"
                                        className={`${authLink} gap-1.5 bg-action text-content-inverted hover:bg-action-hover`}
                                    >
                                        <SiteIcon name="pencil" className="size-3" /> {ui('New post')}
                                    </a>
                                )}
                                {/* The browser can open this menu natively before the header hydrates. */}
                                <details className="blex-user-menu relative" data-account-menu suppressHydrationWarning>
                                    <summary
                                        className="relative flex cursor-pointer items-center gap-1.5 rounded-full py-1.5 pr-2 pl-1.5 transition-all duration-150 hover:bg-surface-subtle active:scale-95"
                                        aria-label={ui('User menu')}
                                    >
                                        <span className="flex size-8 items-center justify-center rounded-full bg-action text-xs font-semibold text-content-inverted">
                                            {viewer.username?.slice(0, 1).toUpperCase() || 'B'}
                                        </span>
                                        {Boolean(viewer.unreadCount) && (
                                            <span className="absolute top-0 left-6 size-3.5 rounded-full bg-danger ring-2 ring-surface" />
                                        )}
                                        <SiteIcon name="chevron-down" className="size-[9px] text-content-hint" />
                                    </summary>
                                    <div className="absolute right-0 z-50 mt-2 w-52 rounded-xl bg-surface-elevated py-1 shadow-lg ring-1 ring-line/50">
                                        <div className="border-b border-line-light px-4 py-3.5">
                                            <p className="text-xs text-content-secondary">{ui('Signed in as')}</p>
                                            <p className="mt-0.5 truncate text-sm font-semibold">{viewer.username}</p>
                                        </div>
                                        <AccountLinks viewer={viewer} />
                                    </div>
                                </details>
                            </>
                        ) : (
                            !hideAuthLinks && (
                                <>
                                    <a
                                        href={loginHref}
                                        className={`${authLink} text-content-secondary hover:bg-surface-subtle hover:text-content`}
                                    >
                                        {ui('Log in')}
                                    </a>
                                    <a
                                        href="/sign"
                                        className={`${authLink} bg-action text-content-inverted hover:bg-action-hover`}
                                    >
                                        {ui('Sign up')}
                                    </a>
                                </>
                            )
                        )}
                    </nav>
                    <nav className="flex shrink-0 items-center gap-1 md:hidden" aria-label={ui('Mobile menu')}>
                        {!searchPage && (
                            <a href="/search" className={iconButton} aria-label={ui('Search')}>
                                <SiteIcon name="search" className="size-4" />
                            </a>
                        )}
                        {viewer && (
                            <a href="/settings/notify" className={iconButton} aria-label={ui('Notifications')}>
                                <SiteIcon name="bell" className="size-4" />
                            </a>
                        )}
                        <ThemeButton />
                        {/* The site script can open the menu before the header hydrates. */}
                        <button
                            type="button"
                            className={iconButton}
                            data-site-menu-open
                            aria-label={ui('Menu')}
                            aria-controls="blex-mobile-menu"
                            aria-expanded="false"
                            suppressHydrationWarning
                        >
                            <SiteIcon name="menu-2" className="size-4" />
                        </button>
                    </nav>
                </div>
            </div>
            <dialog
                id="blex-mobile-menu"
                className="blex-menu fixed inset-y-0 right-0 left-auto m-0 w-72 max-w-[90vw] bg-surface-elevated p-0 text-content shadow-xl"
                suppressHydrationWarning
            >
                <div className="flex h-full flex-col">
                    <div className="flex h-14 shrink-0 items-center justify-between border-b border-line-light px-4">
                        <span className="text-sm font-semibold text-content">{ui('Menu')}</span>
                        <form method="dialog">
                            <button type="submit" className={iconButton} aria-label={ui('Close')}>
                                <SiteIcon name="x" className="text-base" />
                            </button>
                        </form>
                    </div>
                    <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label={ui('Site menu')}>
                        {viewer ? (
                            <>
                                <div className="mb-1 flex items-center gap-3 px-3 py-3">
                                    <div className="flex size-9 items-center justify-center rounded-full bg-action text-sm font-semibold text-content-inverted">
                                        {viewer.username?.slice(0, 1).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-content">{viewer.username}</p>
                                    </div>
                                </div>
                                <AccountLinks viewer={viewer} mobile newPost={viewer.hasEditorRole && !editorPage} />
                            </>
                        ) : (
                            !hideAuthLinks && (
                                <div className="space-y-1 py-1">
                                    <a href={loginHref} className={`${mobileItem} text-content-secondary`}>
                                        <SiteIcon name="login-2" className="w-5 text-xs text-content-hint" />
                                        <span>{ui('Log in')}</span>
                                    </a>
                                    <a href="/sign" className={`${mobileItem} font-medium text-content`}>
                                        <SiteIcon name="user-plus" className="w-5 text-xs text-content-secondary" />
                                        <span>{ui('Sign up')}</span>
                                    </a>
                                </div>
                            )
                        )}
                    </nav>
                </div>
            </dialog>
        </header>
    );
}

export function SiteFooter({
    brand,
    year = new Date().getFullYear()
}: {
    brand?: Brand;
    /** Set by pages that hydrate, so the browser's clock cannot change the server's text. */
    year?: number;
}) {
    return (
        <footer className="mt-auto border-t border-line-light bg-surface">
            <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
                {Boolean(brand?.footerPages?.length) && (
                    <nav className="mb-8 flex flex-wrap justify-center gap-2" aria-label={ui('Site information')}>
                        {brand?.footerPages?.map((page) => (
                            <a
                                key={page.slug}
                                href={`/static/${encodeURIComponent(page.slug)}`}
                                className="rounded-lg px-4 py-2 text-sm text-content-secondary transition-all duration-150 hover:bg-surface-subtle hover:text-content"
                            >
                                {page.title}
                            </a>
                        ))}
                    </nav>
                )}
                <div className="flex flex-col items-center gap-3">
                    <SiteLogo brand={brand} small />
                    <p className="text-xs text-content-hint">
                        {`© ${year} ${brand?.siteName ?? 'BLEX'}. All rights reserved.`}
                    </p>
                </div>
            </div>
        </footer>
    );
}
