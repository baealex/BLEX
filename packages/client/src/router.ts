import { createRouter } from '@tanstack/react-router';
import type { SettingsRouterContext } from '~/features/settings/access';
import { isSettingsPath } from '~/features/settings/settings-mode';
import { applicationHistory } from '~/application/history';
import { routeTree } from './routeTree.gen';

export const createClientRouter = (context: SettingsRouterContext) => {
    let shownLocation: { pathname: string; search: string; hash: string } | null = null;

    return createRouter({
        routeTree,
        context,
        history: applicationHistory(),
        defaultPreload: 'intent',
        rewrite: {
            input: ({ url }) => {
                if (isSettingsPath(url.pathname)) {
                    shownLocation = {
                        pathname: url.pathname,
                        search: url.search,
                        hash: url.hash
                    };
                } else if (shownLocation) {
                    // Another page is loading. This screen stays put until that page replaces it.
                    url.pathname = shownLocation.pathname;
                    url.search = shownLocation.search;
                    url.hash = shownLocation.hash;
                }
                return url;
            }
        }
    });
};

declare module '@tanstack/react-router' {
    interface Register {
        router: ReturnType<typeof createClientRouter>;
    }
}
