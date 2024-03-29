import type { GetServerSideProps } from 'next';

import { CollectionLayout } from '@system-design/article';
import type { PageComponent } from '~/components';

import * as API from '~/modules/api';

type Props = API.GetPostsResponseData;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
    try {
        const { data } = await API.getPopularPosts(1, context.req.headers.cookie);

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
    return <></>;
};

TrendyArticles.pageLayout = (page, props) => (
    <CollectionLayout active="인기 포스트" {...props}>
        {page}
    </CollectionLayout>
);

export default TrendyArticles;
