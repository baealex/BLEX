import {
    RouterProvider,
    createRouter,
    createRootRoute,
    createRoute,
    Outlet,
    Navigate,
    useRouter
} from '@tanstack/react-router';
import {
 lazy, useEffect, useState, Suspense, type ElementType
} from 'react';
import { useLingui } from '@lingui/react/macro';
import { SettingsLayout } from './components/SettingsLayout';
import { LoadingState } from '../../shared';
import {
    currentSettingsMode,
    hasSettingsBasePath,
    settingsBasePaths,
    useSettingsMode
} from './settings-mode';
import { applicationHistory } from '~/lib/application-history';

// Lazy load settings pages
const NotifySetting = lazy(() => import('./pages/NotifySetting'));
const SubscriptionsSetting = lazy(() => import('./pages/SubscriptionsSetting'));
const AccountSetting = lazy(() => import('./pages/AccountSetting'));
const ProfileSetting = lazy(() => import('./pages/ProfileSetting'));
const SeriesSetting = lazy(() => import('./pages/SeriesSetting'));
const PostsSetting = lazy(() => import('./pages/PostsSetting'));
const PinnedPostsSetting = lazy(() => import('./pages/PinnedPostsSetting'));
const DraftsSetting = lazy(() => import('./pages/DraftsSetting'));
const FormsSetting = lazy(() => import('./pages/FormsSetting'));
const NoticeSetting = lazy(() => import('./pages/NoticeSetting'));
const BannerSetting = lazy(() => import('./pages/BannerSetting'));
const IntegrationSetting = lazy(() => import('./pages/IntegrationSetting'));
const SocialLinksSetting = lazy(() => import('./pages/SocialLinksSetting'));
const WebhookSetting = lazy(() => import('./pages/WebhookSetting'));
const DeveloperApiSetting = lazy(() => import('./pages/DeveloperApiSetting'));
const GlobalWebhookSetting = lazy(() => import('./pages/GlobalWebhookSetting'));
const GlobalNoticeSetting = lazy(() => import('./pages/GlobalNoticeSetting'));
const GlobalBannerSetting = lazy(() => import('./pages/GlobalBannerSetting'));
const SiteSettingSetting = lazy(() => import('./pages/SiteSettingSetting'));
const LoginSetting = lazy(() => import('./pages/LoginSetting'));
const AdminIntegrationSetting = lazy(() => import('./pages/AdminIntegrationSetting'));
const SeoAeoSetting = lazy(() => import('./pages/SeoAeoSetting'));
const StaticPagesSetting = lazy(() => import('./pages/StaticPagesSetting'));
const UtilitySetting = lazy(() => import('./pages/UtilitySetting'));
const UserManagementSetting = lazy(() => import('./pages/UserManagementSetting'));
const ModerationPostsSetting = lazy(() => import('./pages/ModerationPostsSetting'));
const ModerationCommentsSetting = lazy(() => import('./pages/ModerationCommentsSetting'));

// Lazy load fullscreen editors
const SeriesEditor = lazy(() => import('./pages/SeriesSetting/components/SeriesEditor'));
const StaticPageEditor = lazy(() => import('./pages/StaticPagesSetting/components/StaticPageEditor'));
const BannerEditor = lazy(() => import('./pages/BannerSetting/components/BannerEditor'));
const GlobalBannerEditor = lazy(() => import('./pages/GlobalBannerSetting/components/GlobalBannerEditor'));

export interface SettingsAppProps {
    isEditor: boolean;
    isStaff: boolean;
    isSuperuser?: boolean;
    canUseTelegramIntegration?: boolean;
    adminCapabilities?: Partial<AdminCapabilities>;
}

export interface AdminCapabilities {
    canManageSiteSettings: boolean;
    canManageLoginSettings: boolean;
    canManageIntegrationSettings: boolean;
    canManageUtilities: boolean;
}

interface SettingsRouterContext {
    isEditor: boolean;
    isStaff: boolean;
    canUseTelegramIntegration: boolean;
    adminCapabilities: AdminCapabilities;
}

const getAdminDefaultPath = (adminCapabilities: AdminCapabilities) => {
    if (adminCapabilities.canManageSiteSettings) return '/site-settings';
    if (adminCapabilities.canManageLoginSettings) return '/login';
    if (adminCapabilities.canManageIntegrationSettings) return '/integrations';
    return '/global-notices';
};

const SettingsDocumentTitle = () => {
    const settingsMode = useSettingsMode();

    useEffect(() => {
        const label = settingsMode === 'admin' ? '관리자 설정' : '설정';
        document.title = document.title.replace(/^(?:관리자 설정|설정)(?= \|)/, label);
    }, [settingsMode]);

    return null;
};

const SettingsRoot = () => {
    const { t } = useLingui();

    return (
        <Suspense
            fallback={(
                <LoadingState
                    type="form"
                    ariaLabel={t({
                        id: 'common.loading',
                        message: 'Loading'
                    })}
                />
            )}>
            <SettingsDocumentTitle />
            <Outlet />
        </Suspense>
    );
};

// Root route
const rootRoute = createRootRoute({ component: SettingsRoot });

// Settings layout route
const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: 'settings-layout',
    component: SettingsLayout
});

const SettingsIndexRedirect = () => {
    const router = useRouter();
    const settingsMode = useSettingsMode();
    const { adminCapabilities } = router.options.context as SettingsRouterContext;

    return <Navigate to={settingsMode === 'admin' ? getAdminDefaultPath(adminCapabilities) : '/notify'} replace />;
};

const editorOnly = (Component: ElementType) => {
    const EditorOnlyRoute = (props: Record<string, unknown>) => {
        const router = useRouter();
        const { isEditor } = router.options.context as SettingsRouterContext;

        if (!isEditor) {
            return <Navigate to="/notify" replace />;
        }

        return <Component {...props} />;
    };

    return EditorOnlyRoute;
};

const adminCapabilityOnly = (
    capability: keyof AdminCapabilities,
    Component: ElementType
) => {
    const AdminCapabilityOnlyRoute = (props: Record<string, unknown>) => {
        const router = useRouter();
        const settingsMode = useSettingsMode();
        const {
            isStaff,
            adminCapabilities
        } = router.options.context as SettingsRouterContext;

        if (!isStaff) {
            return <Navigate to="/notify" replace />;
        }

        if (!adminCapabilities[capability]) {
            return <Navigate to={settingsMode === 'admin' ? getAdminDefaultPath(adminCapabilities) : '/notify'} replace />;
        }

        return <Component {...props} />;
    };

    return AdminCapabilityOnlyRoute;
};

const telegramIntegrationOnly = (Component: ElementType) => {
    const TelegramIntegrationOnlyRoute = (props: Record<string, unknown>) => {
        const router = useRouter();
        const { canUseTelegramIntegration } = router.options.context as SettingsRouterContext;

        if (!canUseTelegramIntegration) {
            return <Navigate to="/notify" replace />;
        }

        return <Component {...props} />;
    };

    return TelegramIntegrationOnlyRoute;
};

const EditorOnlySeriesEditor = editorOnly(SeriesEditor);
const EditorOnlyBannerEditor = editorOnly(BannerEditor);

// Index route - redirect to the default page for each settings namespace
const indexRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/',
    component: SettingsIndexRedirect
});

// Individual setting routes
const notifyRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/notify',
    component: NotifySetting
});

const subscriptionsRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/subscriptions',
    component: SubscriptionsSetting
});

const accountRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/account',
    component: AccountSetting
});

const profileRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/profile',
    component: ProfileSetting
});

const seriesRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/series',
    component: editorOnly(SeriesSetting)
});

const postsRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/posts',
    component: editorOnly(PostsSetting)
});

const pinnedPostsRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/pinned-posts',
    component: editorOnly(PinnedPostsSetting)
});

const draftsRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/drafts',
    component: editorOnly(DraftsSetting)
});

const formsRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/forms',
    component: editorOnly(FormsSetting)
});

const noticesRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/notices',
    component: editorOnly(NoticeSetting)
});

const bannersRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/banners',
    component: editorOnly(BannerSetting)
});

const integrationRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/integration',
    component: telegramIntegrationOnly(IntegrationSetting)
});

const socialLinksRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/social-links',
    component: SocialLinksSetting
});

const webhookRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/webhook',
    component: editorOnly(WebhookSetting)
});

const developerApiRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/developer-api',
    component: editorOnly(DeveloperApiSetting)
});

const globalWebhookRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/global-webhook',
    component: GlobalWebhookSetting
});

const globalNoticesRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/global-notices',
    component: GlobalNoticeSetting
});

const globalBannersRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/global-banners',
    component: GlobalBannerSetting
});

const siteSettingsRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/site-settings',
    component: adminCapabilityOnly('canManageSiteSettings', SiteSettingSetting)
});

const loginRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/login',
    component: adminCapabilityOnly('canManageLoginSettings', LoginSetting)
});

const adminIntegrationRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/integrations',
    component: adminCapabilityOnly('canManageIntegrationSettings', AdminIntegrationSetting)
});

const seoAeoRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/seo-aeo',
    component: adminCapabilityOnly('canManageSiteSettings', SeoAeoSetting)
});

const staticPagesRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/static-pages',
    component: StaticPagesSetting
});

const utilitiesRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/utilities',
    component: adminCapabilityOnly('canManageUtilities', UtilitySetting)
});

const userManagementRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/users',
    component: UserManagementSetting
});

const moderationPostsRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/moderation/posts',
    component: ModerationPostsSetting
});

const moderationCommentsRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/moderation/comments',
    component: ModerationCommentsSetting
});

// Layout-less routes for fullscreen editors
const staticPageCreateRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/static-pages/create',
    component: StaticPageEditor
});

const staticPageEditRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/static-pages/edit/$pageId',
    component: () => {
        const { pageId } = staticPageEditRoute.useParams();
        return (
            <StaticPageEditor pageId={Number(pageId)} />
        );
    }
});

const seriesCreateRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/series/create',
    component: editorOnly(SeriesEditor)
});

const seriesEditRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/series/edit/$seriesId',
    component: () => {
        const { seriesId } = seriesEditRoute.useParams();
        return (
            <EditorOnlySeriesEditor seriesId={Number(seriesId)} />
        );
    }
});

const bannerCreateRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/banners/create',
    component: editorOnly(BannerEditor)
});

const bannerEditRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/banners/edit/$bannerId',
    component: () => {
        const { bannerId } = bannerEditRoute.useParams();
        return (
            <EditorOnlyBannerEditor bannerId={Number(bannerId)} />
        );
    }
});

const globalBannerCreateRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/global-banners/create',
    component: GlobalBannerEditor
});

const globalBannerEditRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/global-banners/edit/$bannerId',
    component: () => {
        const { bannerId } = globalBannerEditRoute.useParams();
        return (
            <GlobalBannerEditor bannerId={Number(bannerId)} />
        );
    }
});

// Route tree
const routeTree = rootRoute.addChildren([
    seriesCreateRoute,
    seriesEditRoute,
    staticPageCreateRoute,
    staticPageEditRoute,
    bannerCreateRoute,
    bannerEditRoute,
    globalBannerCreateRoute,
    globalBannerEditRoute,
    settingsRoute.addChildren([
        indexRoute,
        notifyRoute,
        subscriptionsRoute,
        accountRoute,
        profileRoute,
        seriesRoute,
        postsRoute,
        pinnedPostsRoute,
        draftsRoute,
        formsRoute,
        noticesRoute,
        bannersRoute,
        socialLinksRoute,
        integrationRoute,
        webhookRoute,
        developerApiRoute,
        globalWebhookRoute,
        globalNoticesRoute,
        globalBannersRoute,
        siteSettingsRoute,
        loginRoute,
        adminIntegrationRoute,
        seoAeoRoute,
        staticPagesRoute,
        utilitiesRoute,
        userManagementRoute,
        moderationPostsRoute,
        moderationCommentsRoute
    ])
]);

// Both settings areas share this tree. The mode follows the URL, so moving between them never reloads the page.
const createSettingsRouter = (context: SettingsRouterContext) => {
    let shownLocation = {
 pathname: '/',
search: '',
hash: ''
};

    return createRouter({
        routeTree,
        context,
        history: applicationHistory(),
        defaultPreload: 'intent',
        rewrite: {
            input: ({ url }) => {
                if (!hasSettingsBasePath(url.pathname)) {
                    // Another page is loading. This screen stays put until that page replaces it.
                    url.pathname = shownLocation.pathname;
                    url.search = shownLocation.search;
                    url.hash = shownLocation.hash;
                    return url;
                }
                const basePath = settingsBasePaths[currentSettingsMode(url.pathname)];
                url.pathname = url.pathname.slice(basePath.length) || '/';
                shownLocation = {
 pathname: url.pathname,
search: url.search,
hash: url.hash
};
                return url;
            },
            output: ({ url }) => {
                if (!hasSettingsBasePath(url.pathname)) {
                    url.pathname = `${settingsBasePaths[currentSettingsMode(window.location.pathname)]}${url.pathname}`;
                }
                return url;
            }
        }
    });
};

const SettingsApp = ({
    isEditor,
    isStaff,
    isSuperuser = false,
    canUseTelegramIntegration = false,
    adminCapabilities
}: SettingsAppProps) => {
    const legacyStaffCapabilities = adminCapabilities === undefined && isStaff;
    const [router] = useState(() => createSettingsRouter({
        isEditor,
        isStaff,
        canUseTelegramIntegration,
        adminCapabilities: {
            canManageSiteSettings: isSuperuser
                || adminCapabilities?.canManageSiteSettings === true
                || legacyStaffCapabilities,
            canManageLoginSettings: isSuperuser
                || adminCapabilities?.canManageLoginSettings === true
                || legacyStaffCapabilities,
            canManageIntegrationSettings: isSuperuser
                || adminCapabilities?.canManageIntegrationSettings === true
                || legacyStaffCapabilities,
            canManageUtilities: isSuperuser
                || adminCapabilities?.canManageUtilities === true
                || legacyStaffCapabilities
        }
    }));

    return <RouterProvider router={router} />;
};

export default SettingsApp;
