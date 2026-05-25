import { lazy, Suspense, useEffect } from 'react';

interface AppProps {
    __name: keyof typeof LazyComponents;
    __onMounted?: () => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

const LazyComponents = {
    // Island components
    Comments: lazy(() => import('./remotes/Comments')),
    SocialLogin: lazy(() => import('./remotes/SocialLogin')),
    RelatedPosts: lazy(() => import('./remotes/RelatedPosts')),
    SearchPage: lazy(() => import('./remotes/SearchPage')),
    LoginPrompt: lazy(() => import('./remotes/LoginPrompt')),
    Toaster: lazy(() => import('./remotes/Toaster')),
    Heatmap: lazy(() => import('./remotes/Author/Heatmap')),

    // Pages
    Login: lazy(() => import('./remotes/Login')),
    Signup: lazy(() => import('./remotes/Signup')),
    PostEditor: lazy(() => import('./remotes/PostEditor')),
    // Unified Settings App
    SettingsApp: lazy(() => import('./remotes/SettingsApp'))
};

const MountNotifier = ({ onMounted }: { onMounted?: () => void }) => {
    useEffect(() => {
        onMounted?.();
    }, [onMounted]);

    return null;
};

const App = ({ __name, __onMounted, ...props }: AppProps) => {
    const Component = LazyComponents[__name];

    return (
        <Suspense>
            {/* @ts-expect-error - 동적 컴포넌트 props 타입 처리를 위한 임시 방법 */}
            <Component {...props} />
            <MountNotifier onMounted={__onMounted} />
        </Suspense>
    );
};

export default App;
