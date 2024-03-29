import type { GetServerSideProps } from 'next';

import { CollectionLayout } from '@system-design/article';
import type { PageComponent } from '~/components';
import { SEO } from '@system-design/shared';

import * as API from '~/modules/api';
import { CONFIG } from '~/modules/settings';

type Props = API.GetPostsResponseData;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
    try {
        const { data } = await API.getLikedPosts(1, context.req.headers.cookie);

        return {
            props: {
                ...data.body
            }
        };
    } catch (error) {
        return { notFound: true };
    }
};

const TrendyArticles: PageComponent<Props> = () => {
    return (
        <>
            <SEO title={`관심 포스트 | ${CONFIG.BLOG_TITLE}`} />
        </>
    );
};

TrendyArticles.pageLayout = (page, props) => (
    <CollectionLayout active="관심 포스트" {...props}>
        {page}
    </CollectionLayout>
);

export default TrendyArticles;
