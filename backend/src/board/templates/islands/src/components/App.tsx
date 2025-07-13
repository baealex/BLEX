import { lazy, Suspense } from 'react';

interface AppProps {
    __name: string;
    [key: string]: any;
}

const LazyComponents = {
    LikeButton: lazy(() => import('./LikeButton')),
    SearchBox: lazy(() => import('./SearchBox')),
    Comments: lazy(() => import('./Comments')),
    SocialLinks: lazy(() => import('./SocialLinks')),
    ProfileForm: lazy(() => import('./ProfileForm')),
    AccountInfo: lazy(() => import('./AccountInfo')),
    PasswordChange: lazy(() => import('./PasswordChange')),
    AccountDeletion: lazy(() => import('./AccountDeletion')),
    SeriesManagement: lazy(() => import('./SeriesManagement')),
    PostsManagement: lazy(() => import('./PostsManagement')),
    NotifySettings: lazy(() => import('./NotifySettings')),
    VisitorAnalytics: lazy(() => import('./VisitorAnalytics')),
    IntegrationSettings: lazy(() => import('./IntegrationSettings')),
    InvitationManagement: lazy(() => import('./InvitationManagement')),
}

const App = ({ __name, ...props }: AppProps) => {
    const Component = LazyComponents[__name as keyof typeof LazyComponents];

    return (
        <Suspense fallback={<></>}>
            <Component {...props as any} />
        </Suspense>
    );
};

export default App;

