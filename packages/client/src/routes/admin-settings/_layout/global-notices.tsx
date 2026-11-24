import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

export const Route = createFileRoute('/admin-settings/_layout/global-notices')({
    component: lazy(() => import('~/features/settings/global-notices'))
});
