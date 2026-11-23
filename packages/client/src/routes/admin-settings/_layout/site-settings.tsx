import { createFileRoute } from '@tanstack/react-router';
import { requireAdminCapability } from '~/features/settings/guards';
import { lazyPage } from '~/features/settings/lazy-page';

export const Route = createFileRoute('/admin-settings/_layout/site-settings')({
    beforeLoad: requireAdminCapability('canManageSiteSettings'),
    component: lazyPage(() => import('~/features/settings/site-settings'))
});
