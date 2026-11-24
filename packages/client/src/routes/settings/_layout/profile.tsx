import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

export const Route = createFileRoute('/settings/_layout/profile')({
    component: lazy(() => import('~/features/settings/profile'))
});
