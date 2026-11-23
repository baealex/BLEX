import { createFileRoute } from '@tanstack/react-router';
import { lazyPage } from '~/features/settings/lazy-page';

export const Route = createFileRoute('/admin-settings/_layout/static-pages')({ component: lazyPage(() => import('~/features/settings/static-pages')) });
