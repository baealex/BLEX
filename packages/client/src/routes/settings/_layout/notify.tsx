import { createFileRoute } from '@tanstack/react-router';
import { lazyPage } from '~/features/settings/lazy-page';

export const Route = createFileRoute('/settings/_layout/notify')({ component: lazyPage(() => import('~/features/settings/notify')) });
