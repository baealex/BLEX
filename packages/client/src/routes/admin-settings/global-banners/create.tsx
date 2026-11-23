import { createFileRoute } from '@tanstack/react-router';
import { lazyPage } from '~/features/settings/lazy-page';

export const Route = createFileRoute('/admin-settings/global-banners/create')({
    component: lazyPage(() => import('~/features/settings/global-banners/components/GlobalBannerEditor'))
});
