import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

export const Route = createFileRoute('/settings/_layout/account')({
    component: lazy(() => import('~/features/settings/account'))
});
