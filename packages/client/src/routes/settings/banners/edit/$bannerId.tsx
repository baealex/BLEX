import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';
import { requireEditor } from '~/features/settings/guards';

const BannerEditor = lazy(() => import('~/features/settings/banners/components/BannerEditor'));

const EditBannerEditor = () => {
    const { bannerId } = Route.useParams();

    return <BannerEditor bannerId={Number(bannerId)} />;
};

export const Route = createFileRoute('/settings/banners/edit/$bannerId')({
    beforeLoad: requireEditor,
    component: EditBannerEditor
});
