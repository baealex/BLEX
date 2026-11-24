import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

export const Route = createFileRoute('/settings/_layout/subscriptions')({
    component: lazy(() => import('~/features/settings/subscriptions'))
});
