import { useState } from 'react';
import { Link, useRouter } from '@tanstack/react-router';
import { Dialog } from '@blex/ui';

interface NavigationItem {
    name: string;
    path: string;
    icon: string;
    requiresEditor?: boolean;
    requiresStaff?: boolean;
}

interface SettingsNavigationProps {
    currentPath: string;
}

const navigationSections = [
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
        title: '콘텐츠',
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
                name: '고정 글',
                path: '/pinned-posts',
                icon: 'fa-thumbtack',
                requiresEditor: true
            },
            {
                name: '임시글',
                path: '/drafts',
                icon: 'fa-save',
                requiresEditor: true
            },
            {
                name: '서식',
                path: '/forms',
                icon: 'fa-align-left',
                requiresEditor: true
            }
        ]
    },
    {
        title: '확장',
        description: '배너, 연동, 웹훅 설정',
        items: [
            {
                name: '배너',
                path: '/banners',
                icon: 'fa-rectangle-ad',
                requiresEditor: true
            },
            {
                name: '연동',
                path: '/integration',
                icon: 'fa-plug'
            },
            {
                name: '웹훅',
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
                name: '정적 페이지',
                path: '/static-pages',
                icon: 'fa-file-lines',
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
        const baseClasses = 'flex items-center px-4 rounded-xl transition-all duration-150';
        const activeClasses = isActive
            ? 'bg-gray-100 text-gray-900 font-bold'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium';
        const iconClasses = isActive ? 'text-gray-900' : 'text-gray-400';
        const mobileClasses = 'py-3';
        const desktopClasses = 'py-2 group';

        if (item.path === 'admin') {
            return (
                <li key={item.path}>
                    <a
                        href={adminUrl}
                        className={`${baseClasses} ${activeClasses} ${desktopClasses} ${mobileClasses}`}
                        onClick={() => handleNavClick(item)}>
                        <i className={`fas ${item.icon} w-6 text-center mr-3 transition-colors ${iconClasses} group-hover:text-gray-600`} />
                        <span>{item.name}</span>
                    </a>
                </li>
            );
        }

        return (
            <li key={item.path}>
                <Link
                    to={item.path}
                    className={`${baseClasses} ${activeClasses} xl:${desktopClasses} ${mobileClasses}`}
                    onClick={() => handleNavClick(item)}>
                    <i className={`fas ${item.icon} w-6 text-center mr-3 transition-colors ${iconClasses} group-hover:text-gray-600`} />
                    <span>{item.name}</span>
                </Link>
            </li>
        );
    };

    const renderSection = (section: typeof navigationSections[0]) => {
        if (section.requiresEditor && !isEditor) return null;
        if (section.requiresStaff && !isStaff) return null;

        return (
            <div key={section.title}>
                <h3 className="px-4 mb-1 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    {section.title}
                </h3>
                {section.description && (
                    <p className="px-4 mb-3 text-xs text-gray-400">
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
            <div className="bg-white/80 backdrop-blur-xl border-b border-gray-200/80 px-4 py-3 flex items-center justify-between">
                <Dialog.Root open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                    <Dialog.Trigger asChild>
                        <button
                            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 active:bg-black/10 transition-colors">
                            <i className="fas fa-bars text-gray-900" />
                        </button>
                    </Dialog.Trigger>
                    <Dialog.Portal>
                        <Dialog.Overlay className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                        <Dialog.Content className="fixed z-50 bg-white shadow-2xl transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left duration-300 inset-y-0 left-0 h-full w-[280px] border-r overflow-y-auto outline-none">
                            <div className="p-6">
                                <Dialog.Title className="sr-only">Navigation Menu</Dialog.Title>
                                <div className="flex items-center justify-between mb-8">
                                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">설정</h2>
                                    <Dialog.Close asChild>
                                        <button
                                            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                                            <i className="fas fa-times text-gray-500" />
                                        </button>
                                    </Dialog.Close>
                                </div>

                                <div className="space-y-8">
                                    {navigationSections.map(section => renderSection(section))}
                                </div>
                            </div>
                        </Dialog.Content>
                    </Dialog.Portal>
                </Dialog.Root>

                <h1 className="text-lg font-bold text-gray-900">설정</h1>
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
        const baseClasses = 'flex items-center px-5 rounded-xl transition-all duration-150';
        const activeClasses = isActive
            ? 'bg-gray-100 text-gray-900 font-semibold'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium';
        const iconClasses = isActive ? 'text-gray-900' : 'text-gray-400';
        const desktopClasses = 'xl:py-2 group';

        if (item.path === 'admin') {
            return (
                <li key={item.path}>
                    <a
                        href={adminUrl}
                        className={`${baseClasses} ${activeClasses} ${desktopClasses}`}
                        onClick={() => handleNavClick(item)}>
                        <i className={`fas ${item.icon} w-7 text-center mr-4 transition-colors ${iconClasses} group-hover:text-gray-600`} />
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
                    <i className={`fas ${item.icon} w-7 text-center mr-4 transition-colors ${iconClasses} group-hover:text-gray-600`} />
                    <span>{item.name}</span>
                </Link>
            </li>
        );
    };

    const renderSection = (section: typeof navigationSections[0]) => {
        if (section.requiresEditor && !isEditor) return null;
        if (section.requiresStaff && !isStaff) return null;

        return (
            <div key={section.title}>
                <h3 className="px-5 mb-1 text-sm font-semibold text-gray-400 uppercase tracking-wider">
                    {section.title}
                </h3>
                {section.description && (
                    <p className="px-5 mb-3 text-xs text-gray-400">
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
        <aside className="hidden xl:block w-72 flex-shrink-0 mt-8">
            <div className="sticky top-24">
                <div className="px-5 mb-6">
                    <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">설정</h2>
                </div>
                <nav className="space-y-8">
                    {navigationSections.map(section => renderSection(section))}
                </nav>
            </div>
        </aside>
    );
};
