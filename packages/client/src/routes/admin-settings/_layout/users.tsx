import { createFileRoute } from '@tanstack/react-router';
import { lazyPage } from '~/features/settings/lazy-page';

export const Route = createFileRoute('/admin-settings/_layout/users')({ component: lazyPage(() => import('~/features/settings/users')) });
