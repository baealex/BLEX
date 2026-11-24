import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

export const Route = createFileRoute('/admin-settings/global-banners/create')({
    component: lazy(() => import('~/features/settings/global-banners/components/GlobalBannerEditor'))
});
