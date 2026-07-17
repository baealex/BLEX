import { useRef, useState } from 'react';
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
    name: string;
    path: string;
    icon: LucideIcon;
    requiresEditor?: boolean;
    requiresStaff?: boolean;
    requiresTelegramIntegration?: boolean;
    requiresAdminCapability?: keyof AdminCapabilities;
}

interface NavigationSection {
    title: string;
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
        title: '일반',
        items: [
            {
                name: '알림',
                path: '/notify',
                icon: Bell
            },
            {
                name: '계정',
                path: '/account',
                icon: UserCog
            },
            {
                name: '프로필',
                path: '/profile',
                icon: UserRound
            },
            {
                name: '소셜 링크',
                path: '/social-links',
                icon: Share2
            }
        ]
    },
    {
        title: '블로그',
        requiresEditor: true,
        items: [
            {
                name: '포스트',
                path: '/posts',
                icon: FileText,
                requiresEditor: true
            },
            {
                name: '시리즈',
                path: '/series',
                icon: Layers3,
                requiresEditor: true
            },
            {
                name: '서식',
                path: '/forms',
                icon: AlignLeft,
                requiresEditor: true
            },
            {
                name: '공지',
                path: '/notices',
                icon: Megaphone,
                requiresEditor: true
            },
            {
                name: '배너',
                path: '/banners',
                icon: Ad,
                requiresEditor: true
            }
        ]
    },
    {
        title: '확장',
        items: [
            {
                name: '텔레그램 연동',
                path: '/integration',
                icon: Plug,
                requiresTelegramIntegration: true
            },
            {
                name: '웹훅 연동',
                path: '/webhook',
                icon: Zap,
                requiresEditor: true
            },
            {
                name: '개발자 API',
                path: '/developer-api',
                icon: Code,
                requiresEditor: true
            }
        ]
    }
];

const adminNavigationSections: NavigationSection[] = [
    {
        title: '사이트',
        requiresStaff: true,
        items: [
            {
                name: '블로그 커스텀',
                path: '/site-settings',
                icon: Palette,
                requiresStaff: true,
                requiresAdminCapability: 'canManageSiteSettings'
            },
            {
                name: '로그인 관리',
                path: '/login',
                icon: LogIn,
                requiresStaff: true,
                requiresAdminCapability: 'canManageLoginSettings'
            },
            {
                name: 'SEO/AEO',
                path: '/seo-aeo',
                icon: Bot,
                requiresStaff: true,
                requiresAdminCapability: 'canManageSiteSettings'
            },
            {
                name: '정적 페이지',
                path: '/static-pages',
                icon: FileText,
                requiresStaff: true
            }
        ]
    },
    {
        title: '운영',
        requiresStaff: true,
        items: [
            {
                name: '전역 공지',
                path: '/global-notices',
                icon: Megaphone,
                requiresStaff: true
            },
            {
                name: '전역 배너',
                path: '/global-banners',
                icon: Ad,
                requiresStaff: true
            },
            {
                name: '전역 웹훅 연동',
                path: '/global-webhook',
                icon: Zap,
                requiresStaff: true
            }
        ]
    },
    {
        title: '확장',
        requiresStaff: true,
        items: [
            {
                name: '텔레그램',
                path: '/integrations',
                icon: Send,
                requiresStaff: true,
                requiresAdminCapability: 'canManageIntegrationSettings'
            }
        ]
    },
    {
        title: '관리',
        requiresStaff: true,
        items: [
            {
                name: '사용자 권한',
                path: '/users',
                icon: Users,
                requiresStaff: true
            },
            {
                name: '유틸리티',
                path: '/utilities',
                icon: Wrench,
                requiresStaff: true,
                requiresAdminCapability: 'canManageUtilities'
            },
            {
                name: '관리자 패널',
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
    const label = isAdminMode ? '내 설정으로 돌아가기' : '관리자 설정';
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
    const settingsLabel = settingsMode === 'admin' ? '관리자 설정' : '설정';
    const navigationSections = getNavigationSections(settingsMode);
    const activeItem = navigationSections
        .flatMap(section => section.items)
        .filter(item => canShowItem(item, isEditor, isStaff, canUseTelegramIntegration, adminCapabilities))
        .find(item => (
            item.path !== 'admin'
            && normalizePath(currentPath, basePath) === normalizePath(item.path, basePath)
        ));
    const activeItemName = activeItem?.name ?? settingsLabel;
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
                        <span className="min-w-0 flex-1">{item.name}</span>
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
                    <span className="min-w-0 flex-1">{item.name}</span>
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
            <div key={section.title}>
                <p className="px-4 mb-1 text-xs font-bold text-content-hint uppercase tracking-wider">
                    {section.title}
                </p>
                <ul className="space-y-1">
                    {visibleItems.map(renderNavItem)}
                </ul>
            </div>
        );
    };

    return (
        <nav aria-label={`${settingsLabel} 탐색`} className="xl:hidden pt-4">
            <Dialog.Root open={mobileMenuOpen} onOpenChange={handleMobileMenuOpenChange}>
                <Dialog.Trigger asChild>
                    <button
                        ref={mobileMenuTriggerRef}
                        type="button"
                        aria-label={`${settingsLabel} 메뉴 열기, 현재 ${activeItemName}`}
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
                            <Dialog.Title className="sr-only">{settingsLabel} 메뉴</Dialog.Title>
                            <div className="mb-6 flex items-center justify-between">
                                <p className="text-xl font-semibold tracking-tight text-content">
                                    {settingsLabel}
                                </p>
                                <Dialog.Close asChild>
                                    <button
                                        type="button"
                                        aria-label={`${settingsLabel} 메뉴 닫기`}
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
    const settingsLabel = settingsMode === 'admin' ? '관리자 설정' : '설정';
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
                        <span className="min-w-0 flex-1">{item.name}</span>
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
                    <span className="min-w-0 flex-1">{item.name}</span>
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
            <div key={section.title}>
                <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-content-hint">
                    {section.title}
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
