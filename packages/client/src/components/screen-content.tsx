import { lazy, useEffect } from 'react';
import type { Screen } from './screen-props';

// A tab opened before a deploy asks for screen files that are gone, so it takes the reload a missing catalog starts.
const reloadingOnFailure =
    <T,>(load: () => Promise<T>) =>
    () =>
        load().catch((error: unknown) => {
            document.dispatchEvent(new Event('blex:catalog-failed'));
            throw error;
        });

const SearchPage = lazy(reloadingOnFailure(() => import('../features/search')));
const Toaster = lazy(reloadingOnFailure(() => import('../features/toaster')));
const Signup = lazy(reloadingOnFailure(() => import('../features/auth/signup')));
const PostEditor = lazy(reloadingOnFailure(() => import('../features/editor')));
const SettingsApp = lazy(reloadingOnFailure(() => import('../features/settings')));

export const MountNotifier = ({ onMounted }: { onMounted: () => void }) => {
    useEffect(onMounted, [onMounted]);

    return null;
};

export const renderScreen = (screen: Screen) => {
    switch (screen.name) {
        case 'SearchPage':
            return <SearchPage {...screen.props} />;
        case 'Toaster':
            return <Toaster />;
        case 'Signup':
            return <Signup />;
        case 'PostEditor':
            return <PostEditor {...screen.props} />;
        case 'SettingsApp':
            return <SettingsApp {...screen.props} />;
    }
};
