import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

const StaticPageEditor = lazy(() => import('~/features/settings/static-pages/components/StaticPageEditor'));

const EditStaticPageEditor = () => {
    const { pageId } = Route.useParams();

    return <StaticPageEditor pageId={Number(pageId)} />;
};

export const Route = createFileRoute('/admin-settings/static-pages/edit/$pageId')({ component: EditStaticPageEditor });
