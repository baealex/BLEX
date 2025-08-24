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
    AboutEditor: lazy(() => import('./AboutEditor')),
    SocialLinks: lazy(() => import('./SocialLinks')),
    ProfileForm: lazy(() => import('./ProfileForm')),
    FormsManagement: lazy(() => import('./FormsManagement')),
    InvitationManagement: lazy(() => import('./InvitationManagement')),
    VisitorAnalytics: lazy(() => import('./VisitorAnalytics')),
    SeriesManagement: lazy(() => import('./SeriesManagement')),
    PostsManagement: lazy(() => import('./PostsManagement')),
    NotifySettings: lazy(() => import('./NotifySettings')),
    AccountSettings: lazy(() => import('./AccountSettings'))
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
