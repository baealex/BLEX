import { createFileRoute } from '@tanstack/react-router';
import { lazyPage } from '~/features/settings/lazy-page';

export const Route = createFileRoute('/admin-settings/_layout/moderation/comments')({ component: lazyPage(() => import('~/features/settings/moderation-comments')) });
