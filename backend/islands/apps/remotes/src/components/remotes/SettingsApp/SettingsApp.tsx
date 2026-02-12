import {
    RouterProvider,
    createRouter,
    createRootRoute,
    createRoute,
    Outlet,
    Navigate
} from '@tanstack/react-router';
import { lazy } from 'react';
import { SettingsLayout } from './components/SettingsLayout';

// Lazy load settings pages
const NotifySetting = lazy(() => import('./pages/NotifySetting'));
const AccountSetting = lazy(() => import('./pages/AccountSetting'));
const ProfileSetting = lazy(() => import('./pages/ProfileSetting'));
const SeriesSetting = lazy(() => import('./pages/SeriesSetting'));
const PostsSetting = lazy(() => import('./pages/PostsSetting'));
const PinnedPostsSetting = lazy(() => import('./pages/PinnedPostsSetting'));
const DraftsSetting = lazy(() => import('./pages/DraftsSetting'));
const FormsSetting = lazy(() => import('./pages/FormsSetting'));
const BannerSetting = lazy(() => import('./pages/BannerSetting'));
const IntegrationSetting = lazy(() => import('./pages/IntegrationSetting'));
const SocialLinksSetting = lazy(() => import('./pages/SocialLinksSetting'));
const WebhookSetting = lazy(() => import('./pages/WebhookSetting'));

export interface SettingsAppProps {
    isEditor: boolean;
    isStaff: boolean;
    adminUrl?: string;
}

// Root route
const rootRoute = createRootRoute({ component: () => <Outlet /> });

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

// Route tree
const routeTree = rootRoute.addChildren([
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
        bannersRoute,
        socialLinksRoute,
        integrationRoute,
        webhookRoute
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
