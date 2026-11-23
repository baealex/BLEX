import { lazy, Suspense, useEffect } from 'react';

interface AppProps {
    __name: keyof typeof LazyComponents;
    __onMounted?: () => void;
    [key: string]: any;
}

const LazyComponents = {
    // Screen components
    SearchPage: lazy(() => import('../features/search')),
    Toaster: lazy(() => import('../features/toaster')),

    // Pages
    Signup: lazy(() => import('../features/auth/signup')),
    PostEditor: lazy(() => import('../features/editor')),
    // Unified Settings App
    SettingsApp: lazy(() => import('../features/settings'))
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
