import { lazy, Suspense } from 'react';
import { ConfirmProvider } from '~/contexts/ConfirmContext';

interface AppProps {
    __name: keyof typeof LazyComponents;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

const LazyComponents = {
    // Island components
    Comments: lazy(() => import('./remotes/Comments')),
    SocialLogin: lazy(() => import('./remotes/SocialLogin')),
    RelatedPosts: lazy(() => import('./remotes/RelatedPosts')),
    SearchModal: lazy(() => import('./remotes/SearchModal')),
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

const App = ({ __name, ...props }: AppProps) => {
    const Component = LazyComponents[__name];

    return (
        <ConfirmProvider>
            <Suspense>
                {/* @ts-expect-error - 동적 컴포넌트 props 타입 처리를 위한 임시 방법 */}
                <Component {...props} />
            </Suspense>
        </ConfirmProvider>
    );
};

export default App;
