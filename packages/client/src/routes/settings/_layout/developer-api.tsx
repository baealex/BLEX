import { createFileRoute } from '@tanstack/react-router';
import { requireEditor } from '~/features/settings/guards';
import { lazy } from 'react';

export const Route = createFileRoute('/settings/_layout/developer-api')({
    beforeLoad: requireEditor,
    component: lazy(() => import('~/features/settings/developer-api'))
});
