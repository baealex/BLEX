import { createFileRoute } from '@tanstack/react-router';
import { requireAdminCapability } from '~/features/settings/guards';
import { lazyPage } from '~/features/settings/lazy-page';

export const Route = createFileRoute('/admin-settings/_layout/login')({
    beforeLoad: requireAdminCapability('canManageLoginSettings'),
    component: lazyPage(() => import('~/features/settings/login'))
});
