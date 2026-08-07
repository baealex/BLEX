import { useRef, useState } from 'react';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { Link, useRouter } from '@tanstack/react-router';
import { Dialog } from '@blex/ui/dialog';
import {
    Ad,
    AlignLeft,
    ArrowLeft,
    Bell,
    Bot,
    ChevronDown,
    ChevronRight,
    Code,
    FileText,
    Layers3,
    LogIn,
    Megaphone,
    Palette,
    Plug,
    Send,
    Settings2,
    Share2,
    Shield,
    UserCog,
    UserRound,
    Users,
    Wrench,
    X,
    Zap,
    type LucideIcon
} from '@blex/ui/icons';
import {
    DIM_OVERLAY_SOFT,
    ENTRANCE_DURATION,
    INTERACTION_DURATION
} from '@blex/ui/design-tokens';
import type { AdminCapabilities } from '../SettingsApp';

interface NavigationItem {
    name: MessageDescriptor;
    path: string;
    icon: LucideIcon;
    requiresEditor?: boolean;
    requiresStaff?: boolean;
    requiresTelegramIntegration?: boolean;
    requiresAdminCapability?: keyof AdminCapabilities;
}

interface NavigationSection {
    title: MessageDescriptor;
    requiresEditor?: boolean;
    requiresStaff?: boolean;
    items: NavigationItem[];
}

interface SettingsNavigationProps {
    currentPath: string;
}

type SettingsMode = 'user' | 'admin';

interface SettingsRouterContext {
    isEditor: boolean;
    isStaff: boolean;
    adminUrl?: string;
    settingsMode: SettingsMode;
    basePath: string;
    canUseTelegramIntegration: boolean;
    adminCapabilities: AdminCapabilities;
}

const userNavigationSections: NavigationSection[] = [
    {
        title: msg({
            id: 'settings.navigation.section.general',
            message: 'General'
        }),
        items: [
            {
                name: msg({
                    id: 'settings.navigation.notifications',
                    message: 'Notifications'
                }),
                path: '/notify',
                icon: Bell
            },
            {
                name: msg({
                    id: 'settings.navigation.account',
                    message: 'Account'
                }),
                path: '/account',
                icon: UserCog
            },
            {
                name: msg({
                    id: 'settings.navigation.profile',
                    message: 'Profile'
                }),
                path: '/profile',
                icon: UserRound
            },
            {
                name: msg({
                    id: 'settings.navigation.social_links',
                    message: 'Social links'
                }),
                path: '/social-links',
                icon: Share2
            }
        ]
    },
    {
        title: msg({
            id: 'settings.navigation.section.blog',
            message: 'Blog'
        }),
        requiresEditor: true,
        items: [
            {
                name: msg({
                    id: 'settings.navigation.posts',
                    message: 'Posts'
                }),
                path: '/posts',
                icon: FileText,
                requiresEditor: true
            },
            {
                name: msg({
                    id: 'settings.navigation.series',
                    message: 'Series'
                }),
                path: '/series',
                icon: Layers3,
                requiresEditor: true
            },
            {
                name: msg({
                    id: 'settings.navigation.forms',
                    message: 'Templates'
                }),
                path: '/forms',
                icon: AlignLeft,
                requiresEditor: true
            },
            {
                name: msg({
                    id: 'settings.navigation.notices',
                    message: 'Notices'
                }),
                path: '/notices',
                icon: Megaphone,
                requiresEditor: true
            },
            {
                name: msg({
                    id: 'settings.navigation.banners',
                    message: 'Banners'
                }),
                path: '/banners',
                icon: Ad,
                requiresEditor: true
            }
        ]
    },
    {
        title: msg({
            id: 'settings.navigation.section.extensions',
            message: 'Extensions'
        }),
        items: [
            {
                name: msg({
                    id: 'settings.navigation.telegram_integration',
                    message: 'Telegram integration'
                }),
                path: '/integration',
                icon: Plug,
                requiresTelegramIntegration: true
            },
            {
                name: msg({
                    id: 'settings.navigation.webhook_integration',
                    message: 'Webhook integration'
                }),
                path: '/webhook',
                icon: Zap,
                requiresEditor: true
            },
            {
                name: msg({
                    id: 'settings.navigation.developer_api',
                    message: 'Developer API'
                }),
                path: '/developer-api',
                icon: Code,
                requiresEditor: true
            }
        ]
    }
];

const adminNavigationSections: NavigationSection[] = [
    {
        title: msg({
            id: 'settings.navigation.section.site',
            message: 'Site'
        }),
        requiresStaff: true,
        items: [
            {
                name: msg({
                    id: 'settings.navigation.site_customization',
                    message: 'Blog customization'
                }),
                path: '/site-settings',
                icon: Palette,
                requiresStaff: true,
                requiresAdminCapability: 'canManageSiteSettings'
            },
            {
                name: msg({
                    id: 'settings.navigation.login_management',
                    message: 'Login management'
                }),
                path: '/login',
                icon: LogIn,
                requiresStaff: true,
                requiresAdminCapability: 'canManageLoginSettings'
            },
            {
                name: msg({
                    id: 'settings.navigation.seo_aeo',
                    message: 'SEO/AEO'
                }),
                path: '/seo-aeo',
                icon: Bot,
                requiresStaff: true,
                requiresAdminCapability: 'canManageSiteSettings'
            },
            {
                name: msg({
                    id: 'settings.navigation.static_pages',
                    message: 'Static pages'
                }),
                path: '/static-pages',
                icon: FileText,
                requiresStaff: true
            }
        ]
    },
    {
        title: msg({
            id: 'settings.navigation.section.operations',
            message: 'Operations'
        }),
        requiresStaff: true,
        items: [
            {
                name: msg({
                    id: 'settings.navigation.global_notices',
                    message: 'Global notices'
                }),
                path: '/global-notices',
                icon: Megaphone,
                requiresStaff: true
            },
            {
                name: msg({
                    id: 'settings.navigation.global_banners',
                    message: 'Global banners'
                }),
                path: '/global-banners',
                icon: Ad,
                requiresStaff: true
            },
            {
                name: msg({
                    id: 'settings.navigation.global_webhook_integration',
                    message: 'Global webhook integration'
                }),
                path: '/global-webhook',
                icon: Zap,
                requiresStaff: true
            }
        ]
    },
    {
        title: msg({
            id: 'settings.navigation.section.extensions',
            message: 'Extensions'
        }),
        requiresStaff: true,
        items: [
            {
                name: msg({
                    id: 'settings.navigation.telegram',
                    message: 'Telegram'
                }),
                path: '/integrations',
                icon: Send,
                requiresStaff: true,
                requiresAdminCapability: 'canManageIntegrationSettings'
            }
        ]
    },
    {
        title: msg({
            id: 'settings.navigation.section.administration',
            message: 'Administration'
        }),
        requiresStaff: true,
        items: [
            {
                name: msg({
                    id: 'settings.navigation.user_permissions',
                    message: 'User permissions'
                }),
                path: '/users',
                icon: Users,
                requiresStaff: true
            },
            {
                name: msg({
                    id: 'settings.navigation.utilities',
                    message: 'Utilities'
                }),
                path: '/utilities',
                icon: Wrench,
                requiresStaff: true,
                requiresAdminCapability: 'canManageUtilities'
            },
            {
                name: msg({
                    id: 'settings.navigation.admin_panel',
                    message: 'Admin panel'
                }),
                path: 'admin',
                icon: Shield,
                requiresStaff: true
            }
        ]
    }
];

const getNavigationSections = (settingsMode: SettingsMode) => (
    settingsMode === 'admin' ? adminNavigationSections : userNavigationSections
);

const canShowItem = (
    item: NavigationItem,
    isEditor: boolean,
    isStaff: boolean,
    canUseTelegramIntegration: boolean,
    adminCapabilities: AdminCapabilities
) => (
    (!item.requiresEditor || isEditor)
    && (!item.requiresStaff || isStaff)
    && (!item.requiresTelegramIntegration || canUseTelegramIntegration)
    && (!item.requiresAdminCapability || adminCapabilities[item.requiresAdminCapability])
);

const canShowSection = (section: NavigationSection, isEditor: boolean, isStaff: boolean) => (
    (!section.requiresEditor || isEditor) && (!section.requiresStaff || isStaff)
);

const normalizePath = (path: string, basePath: string) => {
    const withoutBase = path.startsWith(basePath) ? path.slice(basePath.length) : path;
    const normalized = withoutBase.replace(/\/+$/, '');
    return normalized || '/';
};

const SettingsModeLink = ({
    settingsMode,
    isStaff,
    adminCapabilities,
    mobile = false
}: {
    settingsMode: SettingsMode;
    isStaff: boolean;
    adminCapabilities: AdminCapabilities;
    mobile?: boolean;
}) => {
    const { t } = useLingui();

    if (!isStaff) return null;

    const isAdminMode = settingsMode === 'admin';
    const adminSettingsPath = adminCapabilities.canManageSiteSettings
        ? '/admin-settings/site-settings'
        : adminCapabilities.canManageLoginSettings
            ? '/admin-settings/login'
            : adminCapabilities.canManageIntegrationSettings
                ? '/admin-settings/integrations'
                : '/admin-settings/global-notices';
    const href = isAdminMode ? '/settings/notify' : adminSettingsPath;
    const label = isAdminMode
        ? t({
            id: 'settings.navigation.back_to_personal',
            message: 'Back to my settings'
        })
        : t({
            id: 'settings.navigation.admin_settings',
            message: 'Admin settings'
        });
    const ModeIcon = isAdminMode ? ArrowLeft : Shield;

    return (
        <a
            href={href}
            className={`inline-flex min-h-11 items-center gap-1.5 font-medium text-content-hint transition-colors ${INTERACTION_DURATION} hover:text-content-secondary ${mobile ? 'rounded-xl px-3 text-sm hover:bg-surface-subtle' : 'w-fit rounded-lg text-xs [@media(pointer:fine)]:min-h-9'}`}>
            <ModeIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-content-hint" />
            <span>{label}</span>
            {!isAdminMode && (
                <ChevronRight aria-hidden="true" className="h-3 w-3 shrink-0 text-content-hint" />
            )}
        </a>
    );
};

export const SettingsMobileNavigation = ({ currentPath }: SettingsNavigationProps) => {
    const { i18n, t } = useLingui();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
    const router = useRouter();
    const {
        isEditor,
        isStaff,
        adminUrl,
        settingsMode,
        basePath,
        canUseTelegramIntegration,
        adminCapabilities
    } = router.options.context as SettingsRouterContext;
    const settingsLabel = settingsMode === 'admin'
        ? t({
            id: 'settings.navigation.admin_settings',
            message: 'Admin settings'
        })
        : t({
            id: 'settings.navigation.settings',
            message: 'Settings'
        });
    const navigationSections = getNavigationSections(settingsMode);
    const activeItem = navigationSections
        .flatMap(section => section.items)
        .filter(item => canShowItem(item, isEditor, isStaff, canUseTelegramIntegration, adminCapabilities))
        .find(item => (
            item.path !== 'admin'
            && normalizePath(currentPath, basePath) === normalizePath(item.path, basePath)
        ));
    const activeItemName = activeItem ? i18n._(activeItem.name) : settingsLabel;
    const handleMobileMenuOpenChange = (open: boolean) => {
        setMobileMenuOpen(open);
        if (!open) {
            window.requestAnimationFrame(() => mobileMenuTriggerRef.current?.focus());
        }
    };
    const handleNavClick = (item: NavigationItem) => {
        handleMobileMenuOpenChange(false);
        if (item.path === 'admin' && adminUrl) {
            window.location.assign(adminUrl);
        }
    };

    const renderNavItem = (item: NavigationItem) => {
        if (!canShowItem(item, isEditor, isStaff, canUseTelegramIntegration, adminCapabilities)) return null;

        const isActive = item.path !== 'admin' && normalizePath(currentPath, basePath) === normalizePath(item.path, basePath);
        const baseClasses = `group flex min-h-11 items-center rounded-lg px-3 py-2.5 text-sm transition-all ${INTERACTION_DURATION} active:scale-95 motion-reduce:transform-none motion-reduce:transition-none`;
        const activeClasses = isActive
            ? 'bg-surface-subtle text-content font-semibold'
            : 'text-content-secondary hover:bg-surface-subtle hover:text-content font-medium';
        const iconClasses = isActive ? 'text-content' : 'text-content-hint';
        const ItemIcon = item.icon;

        if (item.path === 'admin') {
            return (
                <li key={item.path}>
                    <a
                        href={adminUrl}
                        className={`${baseClasses} ${activeClasses}`}
                        onClick={() => handleNavClick(item)}>
                        <span
                            aria-hidden="true"
                            className={`mr-3 inline-flex w-6 shrink-0 justify-center transition-colors ${iconClasses} group-hover:text-content-secondary`}>
                            <ItemIcon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">{i18n._(item.name)}</span>
                    </a>
                </li>
            );
        }

        return (
            <li key={item.path}>
                <Link
                    to={item.path}
                    aria-current={isActive ? 'page' : undefined}
                    className={`${baseClasses} ${activeClasses}`}
                    onClick={() => handleNavClick(item)}>
                    <span
                        aria-hidden="true"
                        className={`mr-3 inline-flex w-6 shrink-0 justify-center transition-colors ${iconClasses} group-hover:text-content-secondary`}>
                        <ItemIcon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">{i18n._(item.name)}</span>
                </Link>
            </li>
        );
    };

    const renderSection = (section: NavigationSection) => {
        if (!canShowSection(section, isEditor, isStaff)) return null;

        const visibleItems = section.items.filter(item => (
            canShowItem(item, isEditor, isStaff, canUseTelegramIntegration, adminCapabilities)
        ));
        if (visibleItems.length === 0) return null;

        return (
            <div key={section.title.id}>
                <p className="px-4 mb-1 text-xs font-bold text-content-hint uppercase tracking-wider">
                    {i18n._(section.title)}
                </p>
                <ul className="space-y-1">
                    {visibleItems.map(renderNavItem)}
                </ul>
            </div>
        );
    };

    return (
        <nav
            aria-label={i18n._({
                id: 'settings.navigation.aria_label',
                message: '{settings} navigation',
                values: { settings: settingsLabel }
            })}
            className="xl:hidden pt-4">
            <Dialog.Root open={mobileMenuOpen} onOpenChange={handleMobileMenuOpenChange}>
                <Dialog.Trigger asChild>
                    <button
                        ref={mobileMenuTriggerRef}
                        type="button"
                        aria-label={i18n._({
                            id: 'settings.navigation.open_menu',
                            message: 'Open {settings} menu, current page: {current}',
                            values: {
                                settings: settingsLabel,
                                current: activeItemName
                            }
                        })}
                        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 text-left shadow-subtle transition-all ${INTERACTION_DURATION} hover:bg-surface-subtle active:scale-[0.99] motion-reduce:transform-none motion-reduce:transition-none`}>
                        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-content">
                            <Settings2 aria-hidden="true" className="h-4 w-4 shrink-0" />
                            <span>{settingsLabel}</span>
                        </span>
                        <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-content-secondary">
                            <span className="truncate">{activeItemName}</span>
                            <ChevronDown
                                aria-hidden="true"
                                className={`h-4 w-4 shrink-0 transition-transform ${INTERACTION_DURATION} motion-reduce:transition-none ${mobileMenuOpen ? 'rotate-180' : ''}`}
                            />
                        </span>
                    </button>
                </Dialog.Trigger>
                <Dialog.Portal>
                    <Dialog.Overlay className={`fixed inset-0 ${DIM_OVERLAY_SOFT} z-40 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none`} />
                    <Dialog.Content className={`fixed z-50 bg-surface shadow-2xl transition ease-in-out data-[state=open]:animate-in data-[state=open]:slide-in-from-left ${ENTRANCE_DURATION} motion-reduce:animate-none motion-reduce:transition-none inset-y-0 left-0 h-full w-[280px] overflow-y-auto outline-none`}>
                        <div className="p-6">
                            <Dialog.Title className="sr-only">
                                {i18n._({
                                    id: 'settings.navigation.menu_title',
                                    message: '{settings} menu',
                                    values: { settings: settingsLabel }
                                })}
                            </Dialog.Title>
                            <div className="mb-6 flex items-center justify-between">
                                <p className="text-xl font-semibold tracking-tight text-content">
                                    {settingsLabel}
                                </p>
                                <Dialog.Close asChild>
                                    <button
                                        type="button"
                                        aria-label={i18n._({
                                            id: 'settings.navigation.close_menu',
                                            message: 'Close {settings} menu',
                                            values: { settings: settingsLabel }
                                        })}
                                        className={`w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-subtle active:bg-line active:scale-95 transition-all ${INTERACTION_DURATION} motion-reduce:transform-none motion-reduce:transition-none`}>
                                        <X aria-hidden="true" className="h-5 w-5 text-content-secondary" />
                                    </button>
                                </Dialog.Close>
                            </div>

                            {isStaff && (
                                <div className="-mt-5 mb-8">
                                    <SettingsModeLink
                                        settingsMode={settingsMode}
                                        isStaff={isStaff}
                                        adminCapabilities={adminCapabilities}
                                        mobile
                                    />
                                </div>
                            )}

                            <div className="space-y-6">
                                {navigationSections.map(renderSection)}
                            </div>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </nav>
    );
};

export const SettingsDesktopNavigation = ({ currentPath }: SettingsNavigationProps) => {
    const { i18n, t } = useLingui();
    const router = useRouter();
    const {
        isEditor,
        isStaff,
        adminUrl,
        settingsMode,
        basePath,
        canUseTelegramIntegration,
        adminCapabilities
    } = router.options.context as SettingsRouterContext;
    const settingsLabel = settingsMode === 'admin'
        ? t({
            id: 'settings.navigation.admin_settings',
            message: 'Admin settings'
        })
        : t({
            id: 'settings.navigation.settings',
            message: 'Settings'
        });
    const navigationSections = getNavigationSections(settingsMode);
    const handleNavClick = (item: NavigationItem) => {
        if (item.path === 'admin' && adminUrl) {
            window.location.assign(adminUrl);
        }
    };

    const renderNavItem = (item: NavigationItem) => {
        if (!canShowItem(item, isEditor, isStaff, canUseTelegramIntegration, adminCapabilities)) return null;

        const isActive = item.path !== 'admin' && normalizePath(currentPath, basePath) === normalizePath(item.path, basePath);
        const baseClasses = `flex min-h-11 items-center rounded-lg px-3 text-sm transition-all ${INTERACTION_DURATION} active:scale-95 [@media(pointer:fine)]:min-h-9`;
        const activeClasses = isActive
            ? 'bg-surface-subtle text-content font-semibold'
            : 'text-content-secondary hover:bg-surface-subtle hover:text-content font-medium';
        const iconClasses = isActive ? 'text-content' : 'text-content-hint';
        const desktopClasses = 'group py-2';
        const ItemIcon = item.icon;

        if (item.path === 'admin') {
            return (
                <li key={item.path}>
                    <a
                        href={adminUrl}
                        className={`${baseClasses} ${activeClasses} ${desktopClasses}`}
                        onClick={() => handleNavClick(item)}>
                        <span
                            aria-hidden="true"
                            className={`mr-3 inline-flex w-5 shrink-0 justify-center transition-colors ${iconClasses} group-hover:text-content-secondary`}>
                            <ItemIcon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">{i18n._(item.name)}</span>
                    </a>
                </li>
            );
        }

        return (
            <li key={item.path}>
                <Link
                    to={item.path}
                    aria-current={isActive ? 'page' : undefined}
                    className={`${baseClasses} ${activeClasses} ${desktopClasses}`}
                    onClick={() => handleNavClick(item)}>
                    <span
                        aria-hidden="true"
                        className={`mr-3 inline-flex w-5 shrink-0 justify-center transition-colors ${iconClasses} group-hover:text-content-secondary`}>
                        <ItemIcon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">{i18n._(item.name)}</span>
                </Link>
            </li>
        );
    };

    const renderSection = (section: NavigationSection) => {
        if (!canShowSection(section, isEditor, isStaff)) return null;

        const visibleItems = section.items.filter(item => (
            canShowItem(item, isEditor, isStaff, canUseTelegramIntegration, adminCapabilities)
        ));
        if (visibleItems.length === 0) return null;

        return (
            <div key={section.title.id}>
                <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-content-hint">
                    {i18n._(section.title)}
                </p>
                <ul className="space-y-1">
                    {visibleItems.map(renderNavItem)}
                </ul>
            </div>
        );
    };

    return (
        <aside className="sticky top-24 mt-8 hidden w-64 flex-shrink-0 self-start xl:block">
            <div className="mb-5 px-3">
                <p className="text-lg font-semibold tracking-tight text-content">
                    {settingsLabel}
                </p>
                {isStaff && (
                    <div className="mt-3">
                        <SettingsModeLink
                            settingsMode={settingsMode}
                            isStaff={isStaff}
                            adminCapabilities={adminCapabilities}
                        />
                    </div>
                )}
            </div>
            <div className="max-h-[calc(100vh-224px)] overflow-y-auto overscroll-contain pr-2">
                <nav className="space-y-6 pb-4">
                    {navigationSections.map(renderSection)}
                </nav>
            </div>
        </aside>
    );
};
