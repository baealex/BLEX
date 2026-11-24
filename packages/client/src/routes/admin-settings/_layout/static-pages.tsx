import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

export const Route = createFileRoute('/admin-settings/_layout/static-pages')({
    component: lazy(() => import('~/features/settings/static-pages'))
});
