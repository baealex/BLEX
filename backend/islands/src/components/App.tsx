import { lazy, Suspense } from 'react';

interface AppProps {
    __name: keyof typeof LazyComponents;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

const LazyComponents = {
    Comments: lazy(() => import('./remotes/Comments')),
    PostEditor: lazy(() => import('./remotes/PostEditor')),
    Login: lazy(() => import('./remotes/Login')),
    SocialLogin: lazy(() => import('./remotes/SocialLogin')),
    RelatedPosts: lazy(() => import('./remotes/RelatedPosts')),
    SearchModal: lazy(() => import('./remotes/SearchModal')),
    InvitationRequest: lazy(() => import('./remotes/InvitationRequest')),

    // Settings
    OverviewSetting: lazy(() => import('./remotes/Settings/OverviewSetting')),
    FormsSetting: lazy(() => import('./remotes/Settings/FormsSetting')),
    IntegrationSetting: lazy(() => import('./remotes/Settings/IntegrationSetting')),
    InvitationSetting: lazy(() => import('./remotes/Settings/InvitationSetting')),
    PostsSetting: lazy(() => import('./remotes/Settings/PostsSetting')),
    SeriesSetting: lazy(() => import('./remotes/Settings/SeriesSetting')),
    AccountSetting: lazy(() => import('./remotes/Settings/AccountSetting')),
    ProfileSetting: lazy(() => import('./remotes/Settings/ProfileSetting')),
    TempPostsSetting: lazy(() => import('./remotes/Settings/TempPostsSetting')),
    SocialLinksSetting: lazy(() => import('./remotes/Settings/SocialLinksSetting'))
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
