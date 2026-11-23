import { lazy, useEffect } from 'react';
import type { Screen } from './screen-props';

const SearchPage = lazy(() => import('../features/search'));
const Toaster = lazy(() => import('../features/toaster'));
const Signup = lazy(() => import('../features/auth/signup'));
const PostEditor = lazy(() => import('../features/editor'));
const SettingsApp = lazy(() => import('../features/settings'));

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
