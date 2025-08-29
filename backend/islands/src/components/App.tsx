import { lazy, Suspense } from 'react';

interface AppProps {
    __name: keyof typeof LazyComponents;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

const LazyComponents = {
    LikeButton: lazy(() => import('./LikeButton')),
    Comments: lazy(() => import('./Comments')),
    MarkdownEditor: lazy(() => import('./MarkdownEditor')),
    Heatmap: lazy(() => import('./Heatmap')),
    Login: lazy(() => import('./Login')),
    SocialLogin: lazy(() => import('./SocialLogin')),
    InvitationRequest: lazy(() => import('./InvitationRequest')),

    // Dashboard
    DashboardStats: lazy(() => import('./DashboardStats')),
    DashboardActivities: lazy(() => import('./DashboardActivities')),

    // Settings
    FormsSetting: lazy(() => import('./Settings/FormsSetting')),
    IntegrationSetting: lazy(() => import('./Settings/IntegrationSetting')),
    InvitationSetting: lazy(() => import('./Settings/InvitationSetting')),
    PostsSetting: lazy(() => import('./Settings/PostsSetting')),
    RefererAnalyticsSetting: lazy(() => import('./Settings/RefererAnalyticsSetting')),
    SeriesSetting: lazy(() => import('./Settings/SeriesSetting')),
    VisitorAnalyticsSetting: lazy(() => import('./Settings/VisitorAnalyticsSetting')),
    NotifySetting: lazy(() => import('./Settings/NotifySetting')),
    AccountSetting: lazy(() => import('./Settings/AccountSetting')),
    ProfileSetting: lazy(() => import('./Settings/ProfileSetting')),
    SocialLinksSetting: lazy(() => import('./Settings/SocialLinksSetting'))
};

const App = ({ __name, ...props }: AppProps) => {
    const Component = LazyComponents[__name];

    return (
        <Suspense>
            {/* @ts-expect-error - 동적 컴포넌트 props 타입 처리를 위한 임시 방법 */}
            <Component {...props} />
        </Suspense>
    );
};

export default App;
