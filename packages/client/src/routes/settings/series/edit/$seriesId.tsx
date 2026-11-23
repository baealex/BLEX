import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';
import { requireEditor } from '~/features/settings/guards';

const SeriesEditor = lazy(() => import('~/features/settings/series/components/SeriesEditor'));

const EditSeriesEditor = () => {
    const { seriesId } = Route.useParams();

    return <SeriesEditor seriesId={Number(seriesId)} />;
};

export const Route = createFileRoute('/settings/series/edit/$seriesId')({
    beforeLoad: requireEditor,
    component: EditSeriesEditor
});
