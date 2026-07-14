import { useRef, useState } from 'react';
import { Link, useRouter } from '@tanstack/react-router';
import { Dialog } from '@blex/ui/dialog';
import { ChevronDown, Settings2, X } from '@blex/ui/icons';
import {
    DIM_OVERLAY_SOFT,
    ENTRANCE_DURATION,
    INTERACTION_DURATION
} from '@blex/ui/design-tokens';

interface NavigationItem {
    name: string;
    path: string;
    icon: string;
    requiresEditor?: boolean;
    requiresStaff?: boolean;
    requiresTelegramIntegration?: boolean;
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
}

const userNavigationSections: NavigationSection[] = [
    {
        title: '일반',
        items: [
            {
                name: '알림',
                path: '/notify',
                icon: 'fa-bell'
            },
            {
                name: '계정',
                path: '/account',
                icon: 'fa-user-cog'
            },
            {
                name: '프로필',
                path: '/profile',
                icon: 'fa-user'
            },
            {
                name: '소셜 링크',
                path: '/social-links',
                icon: 'fa-share-nodes'
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
                icon: 'fa-file-alt',
                requiresEditor: true
            },
            {
                name: '시리즈',
                path: '/series',
                icon: 'fa-layer-group',
                requiresEditor: true
            },
            {
                name: '서식',
                path: '/forms',
                icon: 'fa-align-left',
                requiresEditor: true
            },
            {
                name: '공지',
                path: '/notices',
                icon: 'fa-bullhorn',
                requiresEditor: true
            },
            {
                name: '배너',
                path: '/banners',
                icon: 'fa-rectangle-ad',
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
                icon: 'fa-plug',
                requiresTelegramIntegration: true
            },
            {
                name: '웹훅 연동',
                path: '/webhook',
                icon: 'fa-bolt',
                requiresEditor: true
            },
            {
                name: '개발자 API',
                path: '/developer-api',
                icon: 'fa-code',
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
                icon: 'fa-palette',
                requiresStaff: true
            },
            {
                name: '로그인 관리',
                path: '/login',
                icon: 'fa-right-to-bracket',
                requiresStaff: true
            },
            {
                name: 'SEO/AEO',
                path: '/seo-aeo',
                icon: 'fa-robot',
                requiresStaff: true
            },
            {
                name: '정적 페이지',
                path: '/static-pages',
                icon: 'fa-file-lines',
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
                icon: 'fa-bullhorn',
                requiresStaff: true
            },
            {
                name: '전역 배너',
                path: '/global-banners',
                icon: 'fa-rectangle-ad',
                requiresStaff: true
            },
            {
                name: '전역 웹훅 연동',
                path: '/global-webhook',
                icon: 'fa-bolt',
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
                icon: 'fa-paper-plane',
                requiresStaff: true
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
                icon: 'fa-users',
                requiresStaff: true
            },
            {
                name: '유틸리티',
                path: '/utilities',
                icon: 'fa-toolbox',
                requiresStaff: true
            },
            {
                name: '관리자 패널',
                path: 'admin',
                icon: 'fa-shield-alt',
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
    canUseTelegramIntegration: boolean
) => (
    (!item.requiresEditor || isEditor)
    && (!item.requiresStaff || isStaff)
    && (!item.requiresTelegramIntegration || canUseTelegramIntegration)
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
    mobile = false
}: {
    settingsMode: SettingsMode;
    isStaff: boolean;
    mobile?: boolean;
}) => {
    if (!isStaff) return null;

    const isAdminMode = settingsMode === 'admin';
    const href = isAdminMode ? '/settings/notify' : '/admin-settings/site-settings';
    const label = isAdminMode ? '내 설정으로 돌아가기' : '관리자 설정';
    const icon = isAdminMode ? 'fa-arrow-left' : 'fa-shield-alt';

    return (
        <a
            href={href}
            className={`inline-flex items-center gap-1.5 font-medium text-content-hint transition-colors ${INTERACTION_DURATION} hover:text-content-secondary ${mobile ? 'min-h-11 rounded-xl px-3 text-sm hover:bg-surface-subtle' : 'w-fit text-xs'}`}>
            <i className={`fas ${icon} text-xs text-content-hint`} />
            <span>{label}</span>
            {!isAdminMode && (
                <i className="fas fa-chevron-right text-[10px] text-content-hint" />
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
        canUseTelegramIntegration
    } = router.options.context as SettingsRouterContext;
    const settingsLabel = settingsMode === 'admin' ? '관리자 설정' : '설정';
    const navigationSections = getNavigationSections(settingsMode);
    const activeItem = navigationSections
        .flatMap(section => section.items)
        .filter(item => canShowItem(item, isEditor, isStaff, canUseTelegramIntegration))
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
        if (!canShowItem(item, isEditor, isStaff, canUseTelegramIntegration)) return null;

        const isActive = item.path !== 'admin' && normalizePath(currentPath, basePath) === normalizePath(item.path, basePath);
        const baseClasses = `flex items-center px-4 py-3 rounded-xl transition-all ${INTERACTION_DURATION} active:scale-95 motion-reduce:transform-none motion-reduce:transition-none group`;
        const activeClasses = isActive
            ? 'bg-surface-subtle text-content font-bold'
            : 'text-content-secondary hover:bg-surface-subtle hover:text-content font-medium';
        const iconClasses = isActive ? 'text-content' : 'text-content-hint';

        if (item.path === 'admin') {
            return (
                <li key={item.path}>
                    <a
                        href={adminUrl}
                        className={`${baseClasses} ${activeClasses}`}
                        onClick={() => handleNavClick(item)}>
                        <i className={`fas ${item.icon} w-6 text-center mr-3 transition-colors ${iconClasses} group-hover:text-content-secondary`} />
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
                    <i className={`fas ${item.icon} w-6 text-center mr-3 transition-colors ${iconClasses} group-hover:text-content-secondary`} />
                    <span className="min-w-0 flex-1">{item.name}</span>
                </Link>
            </li>
        );
    };

    const renderSection = (section: NavigationSection) => {
        if (!canShowSection(section, isEditor, isStaff)) return null;

        const visibleItems = section.items.filter(item => canShowItem(item, isEditor, isStaff, canUseTelegramIntegration));
        if (visibleItems.length === 0) return null;

        return (
            <div key={section.title}>
                <h3 className="px-4 mb-1 text-xs font-bold text-content-hint uppercase tracking-wider">
                    {section.title}
                </h3>
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
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-2xl font-bold text-content tracking-tight">
                                    {settingsLabel}
                                </h2>
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
                                    <SettingsModeLink settingsMode={settingsMode} isStaff={isStaff} mobile />
                                </div>
                            )}

                            <div className="space-y-8">
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
        canUseTelegramIntegration
    } = router.options.context as SettingsRouterContext;
    const settingsLabel = settingsMode === 'admin' ? '관리자 설정' : '설정';
    const navigationSections = getNavigationSections(settingsMode);
    const handleNavClick = (item: NavigationItem) => {
        if (item.path === 'admin' && adminUrl) {
            window.location.assign(adminUrl);
        }
    };

    const renderNavItem = (item: NavigationItem) => {
        if (!canShowItem(item, isEditor, isStaff, canUseTelegramIntegration)) return null;

        const isActive = item.path !== 'admin' && normalizePath(currentPath, basePath) === normalizePath(item.path, basePath);
        const baseClasses = `flex items-center px-5 rounded-xl transition-all ${INTERACTION_DURATION} active:scale-95`;
        const activeClasses = isActive
            ? 'bg-surface-subtle text-content font-semibold'
            : 'text-content-secondary hover:bg-surface-subtle hover:text-content font-medium';
        const iconClasses = isActive ? 'text-content' : 'text-content-hint';
        const desktopClasses = 'xl:py-2 group';

        if (item.path === 'admin') {
            return (
                <li key={item.path}>
                    <a
                        href={adminUrl}
                        className={`${baseClasses} ${activeClasses} ${desktopClasses}`}
                        onClick={() => handleNavClick(item)}>
                        <i className={`fas ${item.icon} w-7 text-center mr-4 transition-colors ${iconClasses} group-hover:text-content-secondary`} />
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
                    <i className={`fas ${item.icon} w-7 text-center mr-4 transition-colors ${iconClasses} group-hover:text-content-secondary`} />
                    <span className="min-w-0 flex-1">{item.name}</span>
                </Link>
            </li>
        );
    };

    const renderSection = (section: NavigationSection) => {
        if (!canShowSection(section, isEditor, isStaff)) return null;

        const visibleItems = section.items.filter(item => canShowItem(item, isEditor, isStaff, canUseTelegramIntegration));
        if (visibleItems.length === 0) return null;

        return (
            <div key={section.title}>
                <h3 className="px-5 mb-1 text-sm font-semibold text-content-hint uppercase tracking-wider">
                    {section.title}
                </h3>
                <ul className="space-y-2">
                    {visibleItems.map(renderNavItem)}
                </ul>
            </div>
        );
    };

    return (
        <aside className="hidden xl:block w-72 flex-shrink-0 mt-8 self-start sticky top-24">
            <div className="px-5 mb-6">
                <h2 className="text-2xl font-semibold text-content tracking-tight">
                    {settingsLabel}
                </h2>
                {isStaff && (
                    <div className="mt-3">
                        <SettingsModeLink settingsMode={settingsMode} isStaff={isStaff} />
                    </div>
                )}
            </div>
            <div className="max-h-[calc(100vh-224px)] overflow-y-auto overscroll-contain pr-2">
                <nav className="space-y-8 pb-4">
                    {navigationSections.map(renderSection)}
                </nav>
            </div>
        </aside>
    );
};
