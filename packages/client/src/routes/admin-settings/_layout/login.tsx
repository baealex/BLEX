import { createFileRoute } from '@tanstack/react-router';
import { requireAdminCapability } from '~/features/settings/guards';
import { lazy } from 'react';

export const Route = createFileRoute('/admin-settings/_layout/login')({
    beforeLoad: requireAdminCapability('canManageLoginSettings'),
    component: lazy(() => import('~/features/settings/login'))
});
