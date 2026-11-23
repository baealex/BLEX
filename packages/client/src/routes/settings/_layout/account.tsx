import { createFileRoute } from '@tanstack/react-router';
import { lazyPage } from '~/features/settings/lazy-page';

export const Route = createFileRoute('/settings/_layout/account')({
    component: lazyPage(() => import('~/features/settings/account'))
});
