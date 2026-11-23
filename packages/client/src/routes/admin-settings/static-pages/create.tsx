import { createFileRoute } from '@tanstack/react-router';
import { lazyPage } from '~/features/settings/lazy-page';

export const Route = createFileRoute('/admin-settings/static-pages/create')({ component: lazyPage(() => import('~/features/settings/static-pages/components/StaticPageEditor')) });
