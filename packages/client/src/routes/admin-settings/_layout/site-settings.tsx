import { createFileRoute } from '@tanstack/react-router';
import { requireAdminCapability } from '~/features/settings/guards';
import { lazy } from 'react';

export const Route = createFileRoute('/admin-settings/_layout/site-settings')({
    beforeLoad: requireAdminCapability('canManageSiteSettings'),
    component: lazy(() => import('~/features/settings/site-settings'))
});
