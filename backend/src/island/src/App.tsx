import { Suspense, lazy } from 'react';

const Components = {
    LikeButton: lazy(() => import('./components/LikeButton')),
    SearchBox: lazy(() => import('./components/SearchBox')),
    Comments: lazy(() => import('./components/Comments')),
};

interface AppProps {
    ___name: string;
    [key: string]: any;
}

const App = (props: AppProps) => {
    const { ___name, ...rest } = props;

    const Component = Components[___name as keyof typeof Components];

    if (!Component) {
        return <div>Component not found</div>;
    }

    return (
        <Suspense fallback={<div>Loading...</div>}>
            <Component {...rest as any} />
        </Suspense>
    );
};

export default App;

