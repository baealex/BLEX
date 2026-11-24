import { createFileRoute } from '@tanstack/react-router';
import { requireAdminCapability } from '~/features/settings/guards';
import { lazy } from 'react';

export const Route = createFileRoute('/admin-settings/_layout/seo-aeo')({
    beforeLoad: requireAdminCapability('canManageSiteSettings'),
    component: lazy(() => import('~/features/settings/seo-aeo'))
});
