import {
    RouterProvider,
    createRouter,
    createRootRoute,
    createRoute,
    Outlet,
    Navigate
} from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { SettingsLayout } from './components/SettingsLayout';
import { LoadingState } from '../../shared';

// Lazy load settings pages
const NotifySetting = lazy(() => import('./pages/NotifySetting'));
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
const GlobalWebhookSetting = lazy(() => import('./pages/GlobalWebhookSetting'));
const GlobalNoticeSetting = lazy(() => import('./pages/GlobalNoticeSetting'));
const GlobalBannerSetting = lazy(() => import('./pages/GlobalBannerSetting'));
const SiteSettingSetting = lazy(() => import('./pages/SiteSettingSetting'));
const StaticPagesSetting = lazy(() => import('./pages/StaticPagesSetting'));
const UtilitySetting = lazy(() => import('./pages/UtilitySetting'));

// Lazy load fullscreen editors
const SeriesEditor = lazy(() => import('./pages/SeriesSetting/components/SeriesEditor'));
const StaticPageEditor = lazy(() => import('./pages/StaticPagesSetting/components/StaticPageEditor'));
const BannerEditor = lazy(() => import('./pages/BannerSetting/components/BannerEditor'));
const GlobalBannerEditor = lazy(() => import('./pages/GlobalBannerSetting/components/GlobalBannerEditor'));

export interface SettingsAppProps {
    isEditor: boolean;
    isStaff: boolean;
    adminUrl?: string;
}

// Root route
const rootRoute = createRootRoute({
    component: () => (
        <Suspense fallback={<LoadingState type="form" />}>
            <Outlet />
        </Suspense>
    )
});

// Settings layout route
const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: 'settings-layout',
    component: SettingsLayout
});

// Index route - redirect to /notify by default
const indexRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/',
    component: () => <Navigate to="/notify" replace />
});

// Individual setting routes
const notifyRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/notify',
    component: NotifySetting
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
    component: SeriesSetting
});

const postsRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/posts',
    component: PostsSetting
});

const pinnedPostsRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/pinned-posts',
    component: PinnedPostsSetting
});

const draftsRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/drafts',
    component: DraftsSetting
});

const formsRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/forms',
    component: FormsSetting
});

const noticesRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/notices',
    component: NoticeSetting
});

const bannersRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/banners',
    component: BannerSetting
});

const integrationRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/integration',
    component: IntegrationSetting
});

const socialLinksRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/social-links',
    component: SocialLinksSetting
});

const webhookRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/webhook',
    component: WebhookSetting
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
    component: SiteSettingSetting
});

const staticPagesRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/static-pages',
    component: StaticPagesSetting
});

const utilitiesRoute = createRoute({
    getParentRoute: () => settingsRoute,
    path: '/utilities',
    component: UtilitySetting
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
    component: SeriesEditor
});

const seriesEditRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/series/edit/$seriesId',
    component: () => {
        const { seriesId } = seriesEditRoute.useParams();
        return (
            <SeriesEditor seriesId={Number(seriesId)} />
        );
    }
});

const bannerCreateRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/banners/create',
    component: BannerEditor
});

const bannerEditRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/banners/edit/$bannerId',
    component: () => {
        const { bannerId } = bannerEditRoute.useParams();
        return (
            <BannerEditor bannerId={Number(bannerId)} />
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
        globalWebhookRoute,
        globalNoticesRoute,
        globalBannersRoute,
        siteSettingsRoute,
        staticPagesRoute,
        utilitiesRoute
    ])
]);

const SettingsApp = ({ isEditor, isStaff, adminUrl }: SettingsAppProps) => {
    const router = createRouter({
        routeTree,
        context: {
            isEditor,
            isStaff,
            adminUrl
        },
        defaultPreload: 'intent',
        basepath: '/settings'
    });

    return <RouterProvider router={router} />;
};

export default SettingsApp;
