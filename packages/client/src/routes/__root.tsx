import { createRootRouteWithContext } from '@tanstack/react-router';
import type { SettingsRouterContext } from '~/features/settings/access';
import { SettingsRoot } from '~/features/settings/layout/SettingsRoot';

export const Route = createRootRouteWithContext<SettingsRouterContext>()({ component: SettingsRoot });
