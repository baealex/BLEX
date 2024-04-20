import type { GetServerSideProps } from 'next';

import { CollectionLayout } from '@system-design/article';
import type { PageComponent } from '~/components';

import { TrendingPostsWidget } from '~/components/system-design/widgets';

import * as API from '~/modules/api';

type Props = API.GetPostsResponseData;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
    try {
        const { data } = await API.getNewestPosts(1, context.req.headers.cookie);

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
        <TrendingPostsWidget />
    );
};

TrendyArticles.pageLayout = (page, props) => (
    <CollectionLayout
        active="Home"
        {...props}
        widget={page}>
    </CollectionLayout >
);

export default TrendyArticles;
