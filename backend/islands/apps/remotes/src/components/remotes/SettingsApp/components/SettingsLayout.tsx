import { Outlet, useRouterState } from '@tanstack/react-router';
import { Suspense } from 'react';
import { LoadingState } from '../../../shared';
import { SettingsMobileNavigation, SettingsDesktopNavigation } from './SettingsNavigation';

export const SettingsLayout = () => {
    const routerState = useRouterState();
    const currentPath = routerState.location.pathname;

    return (
        <>
            <SettingsMobileNavigation currentPath={currentPath} />
            <div className="max-w-7xl w-full mx-auto px-4 sm:px-6">
                <div className="flex flex-col xl:flex-row xl:items-start gap-8 xl:gap-12">
                    <SettingsDesktopNavigation currentPath={currentPath} />
                    {/* Main Content */}
                    <main className="flex-1 min-w-0 py-6">
                        <Suspense fallback={<LoadingState type="form" />}>
                            <Outlet />
                        </Suspense>
                    </main>
                </div>
            </div>
        </>
    );
};
