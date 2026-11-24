import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

export const Route = createFileRoute('/settings/_layout/notify')({
    component: lazy(() => import('~/features/settings/notify'))
});
