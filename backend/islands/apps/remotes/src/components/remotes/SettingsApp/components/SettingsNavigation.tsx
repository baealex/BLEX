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
    description?: string;
    risk?: 'external' | 'danger';
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

type SettingsMode = 'user' | 'admin';

interface SettingsRouterContext {
    isEditor: boolean;
    isStaff: boolean;
    adminUrl?: string;
    settingsMode: SettingsMode;
    basePath: string;
}

const userNavigationSections: NavigationSection[] = [
    {
        title: '일반',
        description: '알림, 계정, 프로필 관리',
        items: [
            {
                name: '알림',
                path: '/notify',
                icon: 'fa-bell',
                description: '최근 알림과 읽음 상태'
            },
            {
                name: '계정',
                path: '/account',
                icon: 'fa-user-cog',
                description: '아이디, 비밀번호, 보안 설정',
                risk: 'danger'
            },
            {
                name: '프로필',
                path: '/profile',
                icon: 'fa-user',
                description: '공개 프로필과 이미지'
            },
            {
                name: '소셜 링크',
                path: '/social-links',
                icon: 'fa-share-nodes',
                description: '프로필 외부 링크'
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
                description: '발행 글 목록과 관리',
                requiresEditor: true
            },
            {
                name: '시리즈',
                path: '/series',
                icon: 'fa-layer-group',
                description: '시리즈 생성과 순서',
                requiresEditor: true
            },
            {
                name: '고정 포스트',
                path: '/pinned-posts',
                icon: 'fa-thumbtack',
                description: '프로필 대표 글',
                requiresEditor: true
            },
            {
                name: '임시 포스트',
                path: '/drafts',
                icon: 'fa-save',
                description: '저장 중인 글',
                requiresEditor: true
            },
            {
                name: '서식',
                path: '/forms',
                icon: 'fa-align-left',
                description: '반복 작성 템플릿',
                requiresEditor: true
            },
            {
                name: '공지',
                path: '/notices',
                icon: 'fa-bullhorn',
                description: '작가 페이지 공지',
                requiresEditor: true
            },
            {
                name: '배너',
                path: '/banners',
                icon: 'fa-rectangle-ad',
                description: '작가 페이지 배너',
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
                icon: 'fa-plug',
                description: '개인 알림 채널'
            },
            {
                name: '웹훅 연동',
                path: '/webhook',
                icon: 'fa-bolt',
                description: '발행 이벤트 전송',
                requiresEditor: true
            },
            {
                name: '개발자 API',
                path: '/developer-api',
                icon: 'fa-code',
                description: '외부 도구용 API 토큰',
                risk: 'danger'
            }
        ]
    }
];

const adminNavigationSections: NavigationSection[] = [
    {
        title: '사이트',
        description: '전역 설정과 검색 노출',
        requiresStaff: true,
        items: [
            {
                name: '사이트 설정',
                path: '/site-settings',
                icon: 'fa-gear',
                description: '전역 코드와 가입 정책',
                risk: 'danger',
                requiresStaff: true
            },
            {
                name: 'SEO/AEO',
                path: '/seo-aeo',
                icon: 'fa-robot',
                description: '검색/AI 노출 정책',
                risk: 'danger',
                requiresStaff: true
            },
            {
                name: '정적 페이지',
                path: '/static-pages',
                icon: 'fa-file-lines',
                description: '약관, 안내 페이지',
                requiresStaff: true
            }
        ]
    },
    {
        title: '운영',
        description: '공지, 배너, 웹훅 관리',
        requiresStaff: true,
        items: [
            {
                name: '전역 공지',
                path: '/global-notices',
                icon: 'fa-bullhorn',
                description: '사이트 전체 공지',
                requiresStaff: true
            },
            {
                name: '전역 배너',
                path: '/global-banners',
                icon: 'fa-rectangle-ad',
                description: '사이트 전체 배너',
                requiresStaff: true
            },
            {
                name: '전역 웹훅 연동',
                path: '/global-webhook',
                icon: 'fa-bolt',
                description: '전체 발행 이벤트 전송',
                risk: 'danger',
                requiresStaff: true
            }
        ]
    },
    {
        title: '관리',
        description: '정리 도구와 Django 관리자',
        requiresStaff: true,
        items: [
            {
                name: '유틸리티',
                path: '/utilities',
                icon: 'fa-toolbox',
                description: '데이터 정리 도구',
                risk: 'danger',
                requiresStaff: true
            },
            {
                name: '관리자 패널',
                path: 'admin',
                icon: 'fa-shield-alt',
                description: 'Django 관리자 새 화면',
                risk: 'external',
                requiresStaff: true
            }
        ]
    }
];

const getNavigationSections = (settingsMode: SettingsMode) => (
    settingsMode === 'admin' ? adminNavigationSections : userNavigationSections
);

const canShowItem = (item: NavigationItem, isEditor: boolean, isStaff: boolean) => (
    (!item.requiresEditor || isEditor) && (!item.requiresStaff || isStaff)
);

const canShowSection = (section: NavigationSection, isEditor: boolean, isStaff: boolean) => (
    (!section.requiresEditor || isEditor) && (!section.requiresStaff || isStaff)
);

const normalizePath = (path: string, basePath: string) => {
    const withoutBase = path.startsWith(basePath) ? path.slice(basePath.length) : path;
    const normalized = withoutBase.replace(/\/+$/, '');
    return normalized || '/';
};

const findCurrentNavigation = (
    sections: NavigationSection[],
    currentPath: string,
    basePath: string,
    isEditor: boolean,
    isStaff: boolean
) => {
    const normalizedCurrentPath = normalizePath(currentPath, basePath);

    for (const section of sections) {
        if (!canShowSection(section, isEditor, isStaff)) continue;

        const item = section.items.find(candidate => (
            candidate.path !== 'admin' &&
            canShowItem(candidate, isEditor, isStaff) &&
            normalizePath(candidate.path, basePath) === normalizedCurrentPath
        ));

        if (item) {
            return {
                section,
                item
            };
        }
    }

    return null;
};

const RiskBadge = ({ risk }: { risk?: NavigationItem['risk'] }) => {
    if (!risk) return null;

    const label = risk === 'external' ? '외부' : '주의';
    const className = risk === 'external'
        ? 'border-line bg-surface text-content-hint'
        : 'border-warning-line bg-warning-surface text-warning';

    return (
        <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${className}`}>
            {label}
        </span>
    );
};

const SettingsModeLink = ({ settingsMode, isStaff }: { settingsMode: SettingsMode; isStaff: boolean }) => {
    if (!isStaff) return null;

    const isAdminMode = settingsMode === 'admin';
    const href = isAdminMode ? '/settings/notify' : '/admin-settings/site-settings';
    const label = isAdminMode ? '내 설정으로 돌아가기' : '관리자 설정';
    const icon = isAdminMode ? 'fa-arrow-left' : 'fa-shield-alt';

    return (
        <a
            href={href}
            className={`inline-flex h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium text-content-secondary transition-all ${INTERACTION_DURATION} hover:bg-surface-subtle hover:text-content active:scale-95`}>
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
    const router = useRouter();
    const {
        isEditor,
        isStaff,
        adminUrl,
        settingsMode,
        basePath
    } = router.options.context as SettingsRouterContext;
    const navigationSections = getNavigationSections(settingsMode);
    const currentNavigation = findCurrentNavigation(navigationSections, currentPath, basePath, isEditor, isStaff);

    const handleNavClick = (item: NavigationItem) => {
        setMobileMenuOpen(false);
        if (item.path === 'admin' && adminUrl) {
            window.location.assign(adminUrl);
        }
    };

    const renderNavItem = (item: NavigationItem) => {
        if (!canShowItem(item, isEditor, isStaff)) return null;

        const isActive = item.path !== 'admin' && normalizePath(currentPath, basePath) === normalizePath(item.path, basePath);
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
                        <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                                <span>{item.name}</span>
                                <RiskBadge risk={item.risk} />
                            </span>
                            {item.description && (
                                <span className="mt-0.5 block truncate text-xs font-normal text-content-hint">
                                    {item.description}
                                </span>
                            )}
                        </span>
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
                    <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                            <span>{item.name}</span>
                            <RiskBadge risk={item.risk} />
                        </span>
                        {item.description && (
                            <span className="mt-0.5 block truncate text-xs font-normal text-content-hint">
                                {item.description}
                            </span>
                        )}
                    </span>
                </Link>
            </li>
        );
    };

    const renderSection = (section: NavigationSection) => {
        if (!canShowSection(section, isEditor, isStaff)) return null;

        const visibleItems = section.items.filter(item => canShowItem(item, isEditor, isStaff));
        if (visibleItems.length === 0) return null;

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
                    {visibleItems.map(renderNavItem)}
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
                        <Dialog.Content className={`fixed z-50 bg-surface shadow-2xl transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left ${ENTRANCE_DURATION} inset-y-0 left-0 h-full w-[280px] overflow-y-auto outline-none`}>
                            <div className="p-6">
                                <Dialog.Title className="sr-only">Navigation Menu</Dialog.Title>
                                <div className="flex items-center justify-between mb-8">
                                    <h2 className="text-2xl font-bold text-content tracking-tight">
                                        {settingsMode === 'admin' ? '관리자 설정' : '설정'}
                                    </h2>
                                    <Dialog.Close asChild>
                                        <button
                                            className={`w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-subtle active:bg-line active:scale-95 transition-all ${INTERACTION_DURATION}`}>
                                            <i className="fas fa-times text-content-secondary" />
                                        </button>
                                    </Dialog.Close>
                                </div>

                                {isStaff && (
                                    <div className="-mt-5 mb-8">
                                        <SettingsModeLink settingsMode={settingsMode} isStaff={isStaff} />
                                    </div>
                                )}

                                <div className="space-y-8">
                                    {navigationSections.map(renderSection)}
                                </div>
                            </div>
                        </Dialog.Content>
                    </Dialog.Portal>
                </Dialog.Root>

                <div className="min-w-0 text-center">
                    <h1 className="truncate text-lg font-bold text-content">
                        {currentNavigation?.item.name ?? (settingsMode === 'admin' ? '관리자 설정' : '설정')}
                    </h1>
                    {currentNavigation && (
                        <p className="truncate text-xs text-content-hint">
                            {currentNavigation.section.title}
                            {currentNavigation.item.description ? ` · ${currentNavigation.item.description}` : ''}
                        </p>
                    )}
                </div>
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
        adminUrl,
        settingsMode,
        basePath
    } = router.options.context as SettingsRouterContext;
    const navigationSections = getNavigationSections(settingsMode);
    const currentNavigation = findCurrentNavigation(navigationSections, currentPath, basePath, isEditor, isStaff);

    const handleNavClick = (item: NavigationItem) => {
        if (item.path === 'admin' && adminUrl) {
            window.location.assign(adminUrl);
        }
    };

    const renderNavItem = (item: NavigationItem) => {
        if (!canShowItem(item, isEditor, isStaff)) return null;

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
                        <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                                <span>{item.name}</span>
                                <RiskBadge risk={item.risk} />
                            </span>
                            {item.description && (
                                <span className="mt-0.5 block truncate text-xs font-normal text-content-hint">
                                    {item.description}
                                </span>
                            )}
                        </span>
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
                    <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                            <span>{item.name}</span>
                            <RiskBadge risk={item.risk} />
                        </span>
                        {item.description && (
                            <span className="mt-0.5 block truncate text-xs font-normal text-content-hint">
                                {item.description}
                            </span>
                        )}
                    </span>
                </Link>
            </li>
        );
    };

    const renderSection = (section: NavigationSection) => {
        if (!canShowSection(section, isEditor, isStaff)) return null;

        const visibleItems = section.items.filter(item => canShowItem(item, isEditor, isStaff));
        if (visibleItems.length === 0) return null;

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
                    {visibleItems.map(renderNavItem)}
                </ul>
            </div>
        );
    };

    return (
        <aside className="hidden xl:block w-72 flex-shrink-0 mt-8 self-start sticky top-24">
            <div className="px-5 mb-6">
                <h2 className="text-2xl font-semibold text-content tracking-tight">
                    {settingsMode === 'admin' ? '관리자 설정' : '설정'}
                </h2>
                {isStaff && (
                    <div className="mt-3">
                        <SettingsModeLink settingsMode={settingsMode} isStaff={isStaff} />
                    </div>
                )}
                {currentNavigation && (
                    <div className="mt-4 rounded-xl border border-line bg-surface-subtle px-4 py-3">
                        <p className="text-xs font-semibold text-content-hint">{currentNavigation.section.title}</p>
                        <p className="mt-1 text-sm font-bold text-content">{currentNavigation.item.name}</p>
                        {currentNavigation.item.description && (
                            <p className="mt-1 text-xs leading-relaxed text-content-secondary">
                                {currentNavigation.item.description}
                            </p>
                        )}
                    </div>
                )}
            </div>
            <div className="max-h-[calc(100vh-10rem)] overflow-y-auto overscroll-contain pr-2">
                <nav className="space-y-8 pb-4">
                    {navigationSections.map(renderSection)}
                </nav>
            </div>
        </aside>
    );
};
