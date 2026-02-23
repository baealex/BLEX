import { useState } from 'react';
import { Link, useRouter } from '@tanstack/react-router';
import { Dialog } from '@blex/ui/dialog';
import {
    DIM_OVERLAY_SOFT,
    FROSTED_SURFACE,
    ENTRANCE_DURATION,
    INTERACTION_DURATION
} from '@blex/ui/design-tokens';

interface NavigationItem {
    name: string;
    path: string;
    icon: string;
    requiresEditor?: boolean;
    requiresStaff?: boolean;
}

interface NavigationSection {
    title: string;
    description?: string;
    requiresEditor?: boolean;
    requiresStaff?: boolean;
    items: NavigationItem[];
}

interface SettingsNavigationProps {
    currentPath: string;
}

const navigationSections: NavigationSection[] = [
    {
        title: '일반',
        description: '알림, 계정, 프로필 관리',
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
        description: '포스트, 시리즈, 서식 관리',
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
                name: '고정 포스트',
                path: '/pinned-posts',
                icon: 'fa-thumbtack',
                requiresEditor: true
            },
            {
                name: '임시 포스트',
                path: '/drafts',
                icon: 'fa-save',
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
        description: '텔레그램, 웹훅 연동',
        items: [
            {
                name: '텔레그램 연동',
                path: '/integration',
                icon: 'fa-plug'
            },
            {
                name: '웹훅 연동',
                path: '/webhook',
                icon: 'fa-bolt',
                requiresEditor: true
            }
        ]
    },
    {
        title: '관리자',
        description: '사이트 관리',
        requiresStaff: true,
        items: [
            {
                name: '사이트 설정',
                path: '/site-settings',
                icon: 'fa-gear',
                requiresStaff: true
            },
            {
                name: '정적 페이지',
                path: '/static-pages',
                icon: 'fa-file-lines',
                requiresStaff: true
            },
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

export const SettingsMobileNavigation = ({ currentPath }: SettingsNavigationProps) => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const router = useRouter();
    const {
        isEditor,
        isStaff,
        adminUrl
    } = router.options.context as {
        isEditor: boolean;
        isStaff: boolean;
        adminUrl?: string;
    };

    const handleNavClick = (item: NavigationItem) => {
        setMobileMenuOpen(false);
        if (item.path === 'admin' && adminUrl) {
            window.location.assign(adminUrl);
        }
    };

    const renderNavItem = (item: NavigationItem) => {
        if (item.requiresEditor && !isEditor) return null;
        if (item.requiresStaff && !isStaff) return null;

        const isActive = currentPath === `/settings${item.path}` || currentPath === item.path;
        const baseClasses = `flex items-center px-4 py-3 rounded-xl transition-all ${INTERACTION_DURATION} active:scale-95 group`;
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
                        <span>{item.name}</span>
                    </a>
                </li>
            );
        }

        return (
            <li key={item.path}>
                <Link
                    to={item.path}
                    className={`${baseClasses} ${activeClasses}`}
                    onClick={() => handleNavClick(item)}>
                    <i className={`fas ${item.icon} w-6 text-center mr-3 transition-colors ${iconClasses} group-hover:text-content-secondary`} />
                    <span>{item.name}</span>
                </Link>
            </li>
        );
    };

    const renderSection = (section: NavigationSection) => {
        if (section.requiresEditor && !isEditor) return null;
        if (section.requiresStaff && !isStaff) return null;

        return (
            <div key={section.title}>
                <h3 className="px-4 mb-1 text-xs font-bold text-content-hint uppercase tracking-wider">
                    {section.title}
                </h3>
                {section.description && (
                    <p className="px-4 mb-3 text-xs text-content-hint">
                        {section.description}
                    </p>
                )}
                <ul className="space-y-1">
                    {section.items.map(renderNavItem)}
                </ul>
            </div>
        );
    };

    return (
        <div className="xl:hidden mb-6">
            <div className={`${FROSTED_SURFACE} border-b border-line/80 px-4 py-3 flex items-center justify-between`}>
                <Dialog.Root open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                    <Dialog.Trigger asChild>
                        <button
                            className={`w-11 h-11 flex items-center justify-center rounded-full hover:bg-action/5 active:bg-action/10 active:scale-95 transition-all ${INTERACTION_DURATION}`}>
                            <i className="fas fa-bars text-content" />
                        </button>
                    </Dialog.Trigger>
                    <Dialog.Portal>
                        <Dialog.Overlay className={`fixed inset-0 ${DIM_OVERLAY_SOFT} z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0`} />
                        <Dialog.Content className={`fixed z-50 bg-surface shadow-2xl transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left ${ENTRANCE_DURATION} inset-y-0 left-0 h-full w-[280px] border-r overflow-y-auto outline-none`}>
                            <div className="p-6">
                                <Dialog.Title className="sr-only">Navigation Menu</Dialog.Title>
                                <div className="flex items-center justify-between mb-8">
                                    <h2 className="text-2xl font-bold text-content tracking-tight">설정</h2>
                                    <Dialog.Close asChild>
                                        <button
                                            className={`w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-subtle active:bg-line active:scale-95 transition-all ${INTERACTION_DURATION}`}>
                                            <i className="fas fa-times text-content-secondary" />
                                        </button>
                                    </Dialog.Close>
                                </div>

                                <div className="space-y-8">
                                    {navigationSections.map(renderSection)}
                                </div>
                            </div>
                        </Dialog.Content>
                    </Dialog.Portal>
                </Dialog.Root>

                <h1 className="text-lg font-bold text-content">설정</h1>
                <div className="w-10" />
            </div>
        </div>
    );
};

export const SettingsDesktopNavigation = ({ currentPath }: SettingsNavigationProps) => {
    const router = useRouter();
    const {
        isEditor,
        isStaff,
        adminUrl
    } = router.options.context as {
        isEditor: boolean;
        isStaff: boolean;
        adminUrl?: string;
    };

    const handleNavClick = (item: NavigationItem) => {
        if (item.path === 'admin' && adminUrl) {
            window.location.assign(adminUrl);
        }
    };

    const renderNavItem = (item: NavigationItem) => {
        if (item.requiresEditor && !isEditor) return null;
        if (item.requiresStaff && !isStaff) return null;

        const isActive = currentPath === `/settings${item.path}` || currentPath === item.path;
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
                        <span>{item.name}</span>
                    </a>
                </li>
            );
        }

        return (
            <li key={item.path}>
                <Link
                    to={item.path}
                    className={`${baseClasses} ${activeClasses} ${desktopClasses}`}
                    onClick={() => handleNavClick(item)}>
                    <i className={`fas ${item.icon} w-7 text-center mr-4 transition-colors ${iconClasses} group-hover:text-content-secondary`} />
                    <span>{item.name}</span>
                </Link>
            </li>
        );
    };

    const renderSection = (section: NavigationSection) => {
        if (section.requiresEditor && !isEditor) return null;
        if (section.requiresStaff && !isStaff) return null;

        return (
            <div key={section.title}>
                <h3 className="px-5 mb-1 text-sm font-semibold text-content-hint uppercase tracking-wider">
                    {section.title}
                </h3>
                {section.description && (
                    <p className="px-5 mb-3 text-xs text-content-hint">
                        {section.description}
                    </p>
                )}
                <ul className="space-y-2">
                    {section.items.map(renderNavItem)}
                </ul>
            </div>
        );
    };

    return (
        <aside className="hidden xl:block w-72 flex-shrink-0 mt-8 self-start sticky top-24">
            <div className="px-5 mb-6">
                <h2 className="text-2xl font-semibold text-content tracking-tight">설정</h2>
            </div>
            <div className="max-h-[calc(100vh-10rem)] overflow-y-auto overscroll-contain pr-2">
                <nav className="space-y-8 pb-4">
                    {navigationSections.map(renderSection)}
                </nav>
            </div>
        </aside>
    );
};
