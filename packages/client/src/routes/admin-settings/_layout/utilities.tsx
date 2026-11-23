import { createFileRoute } from '@tanstack/react-router';
import { requireAdminCapability } from '~/features/settings/guards';
import { lazyPage } from '~/features/settings/lazy-page';

export const Route = createFileRoute('/admin-settings/_layout/utilities')({
    beforeLoad: requireAdminCapability('canManageUtilities'),
    component: lazyPage(() => import('~/features/settings/utilities'))
});
