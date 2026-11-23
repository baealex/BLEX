import { lazy, type ComponentType } from 'react';

/** Keeps each settings page in its own chunk while the layout's loading state covers the wait. */
export const lazyPage = (load: () => Promise<{ default: ComponentType }>) => {
    const Page = lazy(load);
    const LazyPage = () => <Page />;

    return LazyPage;
};
