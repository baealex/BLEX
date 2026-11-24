import { createFileRoute } from '@tanstack/react-router';
import { requireEditor } from '~/features/settings/guards';
import { lazy } from 'react';

export const Route = createFileRoute('/settings/banners/create')({
    beforeLoad: requireEditor,
    component: lazy(() => import('~/features/settings/banners/components/BannerEditor'))
});
