import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

export const Route = createFileRoute('/admin-settings/_layout/moderation/posts')({
    component: lazy(() => import('~/features/settings/moderation-posts'))
});
