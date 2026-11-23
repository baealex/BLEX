import { createFileRoute } from '@tanstack/react-router';
import { lazyPage } from '~/features/settings/lazy-page';

export const Route = createFileRoute('/admin-settings/_layout/global-notices')({ component: lazyPage(() => import('~/features/settings/global-notices')) });
