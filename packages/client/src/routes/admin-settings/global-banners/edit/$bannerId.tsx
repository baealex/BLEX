import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

const GlobalBannerEditor = lazy(() => import('~/features/settings/global-banners/components/GlobalBannerEditor'));

const EditGlobalBannerEditor = () => {
    const { bannerId } = Route.useParams();

    return <GlobalBannerEditor bannerId={Number(bannerId)} />;
};

export const Route = createFileRoute('/admin-settings/global-banners/edit/$bannerId')({
    component: EditGlobalBannerEditor
});
