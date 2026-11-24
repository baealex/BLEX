import { ui } from '../../../i18n/public-ui.js';
import { WorkLogDeletePage } from '~/features/work-logs/delete-page';
import { renderWorkLogDocument } from '~/features/work-logs/document';
import { createDeleteData, deleteText } from '~/features/work-logs/page-data';
import type { PageProps } from '@blex/contracts/pages';

export default function renderPage(props: PageProps['work-logs/$id/delete']): string {
    const data = createDeleteData(props);
    const heading = props.entry ? ui('Delete entry') : ui('Delete work log');
    return renderWorkLogDocument(
        { title: `${heading} · ${props.log.title}` },
        props,
        <WorkLogDeletePage data={data} text={deleteText(props)} />,
        data
    );
}
