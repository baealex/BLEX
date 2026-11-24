import { ui } from '../../i18n/public-ui.js';
import { renderWorkLogDocument } from '~/features/work-logs/document';
import { WorkLogIndexPage } from '~/features/work-logs/index-page';
import { createIndexData, indexText } from '~/features/work-logs/page-data';
import type { PageProps } from '@blex/contracts/pages';

export default function renderPage(props: PageProps['work-logs/index']): string {
    const data = createIndexData(props);
    return renderWorkLogDocument(
        { title: ui('Work logs · {value0}', { value0: props.brand?.siteName ?? 'BLEX' }) },
        props,
        <WorkLogIndexPage data={data} text={indexText(props)} />,
        data
    );
}
