import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

export const Route = createFileRoute('/settings/_layout/social-links')({
    component: lazy(() => import('~/features/settings/social-links'))
});
