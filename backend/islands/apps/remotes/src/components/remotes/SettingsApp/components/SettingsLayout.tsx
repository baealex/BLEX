import { Outlet, useRouterState } from '@tanstack/react-router';
import { Suspense } from 'react';
import { useLingui } from '@lingui/react/macro';
import { LoadingState } from '../../../shared';
import { SettingsMobileNavigation, SettingsDesktopNavigation } from './SettingsNavigation';

export const SettingsLayout = () => {
    const { t } = useLingui();
    const routerState = useRouterState();
    const currentPath = routerState.location.pathname;

    return (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6">
            <SettingsMobileNavigation currentPath={currentPath} />
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:gap-8">
                <SettingsDesktopNavigation currentPath={currentPath} />
                {/* Main Content */}
                <div className="flex-1 min-w-0 py-6">
                    <Suspense
                        fallback={(
                            <LoadingState
                                type="form"
                                ariaLabel={t({
                                    id: 'common.loading',
                                    message: 'Loading'
                                })}
                            />
                        )}>
                        <Outlet />
                    </Suspense>
                </div>
            </div>
        </div>
    );
};
