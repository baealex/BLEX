import { createFileRoute } from '@tanstack/react-router';
import { requireTelegramIntegration } from '~/features/settings/guards';
import { lazy } from 'react';

export const Route = createFileRoute('/settings/_layout/integration')({
    beforeLoad: requireTelegramIntegration,
    component: lazy(() => import('~/features/settings/integration'))
});
