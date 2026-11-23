import { createFileRoute } from '@tanstack/react-router';
import { requireTelegramIntegration } from '~/features/settings/guards';
import { lazyPage } from '~/features/settings/lazy-page';

export const Route = createFileRoute('/settings/_layout/integration')({
    beforeLoad: requireTelegramIntegration,
    component: lazyPage(() => import('~/features/settings/integration'))
});
