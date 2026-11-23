import { createFileRoute } from '@tanstack/react-router';
import { lazyPage } from '~/features/settings/lazy-page';

export const Route = createFileRoute('/settings/_layout/social-links')({
    component: lazyPage(() => import('~/features/settings/social-links'))
});
