import { createFileRoute } from '@tanstack/react-router';
import { requireEditor } from '~/features/settings/guards';
import { lazyPage } from '~/features/settings/lazy-page';

export const Route = createFileRoute('/settings/_layout/series')({
    beforeLoad: requireEditor,
    component: lazyPage(() => import('~/features/settings/series'))
});
