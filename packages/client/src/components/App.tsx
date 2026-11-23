import { lazy, Suspense, useEffect } from 'react';

interface AppProps {
    __name: keyof typeof LazyComponents;
    __onMounted?: () => void;
    [key: string]: any;
}

const LazyComponents = {
    SearchPage: lazy(() => import('../features/search')),
    Toaster: lazy(() => import('../features/toaster')),

    Signup: lazy(() => import('../features/auth/signup')),
    PostEditor: lazy(() => import('../features/editor')),
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
            {/* @ts-expect-error -- The server supplies the props required by the selected screen. */}
            <Component {...props} />
            <MountNotifier onMounted={__onMounted} />
        </Suspense>
    );
};

export default App;
