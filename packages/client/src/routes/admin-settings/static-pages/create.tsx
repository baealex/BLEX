import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

export const Route = createFileRoute('/admin-settings/static-pages/create')({
    component: lazy(() => import('~/features/settings/static-pages/components/StaticPageEditor'))
});
