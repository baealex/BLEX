import { ui } from '../../../i18n/public-ui.js';
import { WorkLogDetailPage } from '~/features/work-logs/detail-page';
import { renderWorkLogDocument } from '~/features/work-logs/document';
import { createDetailData, detailText } from '~/features/work-logs/page-data';
import type { PageProps } from '@blex/contracts/pages';

export default function renderPage(props: PageProps['work-logs/$id/index']): string {
    const data = createDetailData(props);
    return renderWorkLogDocument(
        { title: ui('{value0} · Work log', { value0: props.log.title }) },
        props,
        <WorkLogDetailPage data={data} text={detailText(props)} />,
        data
    );
}
