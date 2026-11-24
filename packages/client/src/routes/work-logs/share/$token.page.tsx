import { renderWorkLogDocument } from '~/features/work-logs/document';
import { createSharedData, sharedText } from '~/features/work-logs/page-data';
import { WorkLogSharedPage } from '~/features/work-logs/shared-page';
import type { PageProps } from '@blex/contracts/pages';

export default function renderPage(props: PageProps['work-logs/share/$token']): string {
    const data = createSharedData(props);
    return renderWorkLogDocument(
        {
            title: `${props.headline} · ${props.log.title}`,
            shareMeta: props.preview
                ? undefined
                : {
                      title: props.headline,
                      description: `${props.log.title} · ${props.ownerUsername}`,
                      url: props.shareUrl,
                      imageUrl: props.imageUrl ?? undefined
                  }
        },
        props,
        <WorkLogSharedPage data={data} text={sharedText(props)} />,
        data
    );
}
