import { lazy, Suspense } from 'react';

interface AppProps {
    __name: string;
    [key: string]: any;
}

const LazyComponents = {
    LikeButton: lazy(() => import('./LikeButton')),
    SearchBox: lazy(() => import('./SearchBox')),
    Comments: lazy(() => import('./Comments')),
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

