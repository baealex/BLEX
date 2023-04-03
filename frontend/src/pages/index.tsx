import type { GetServerSideProps } from 'next';

import { CollectionLayout } from '@system-design/article';
import type { PageComponent } from '~/components';

import * as API from '~/modules/api';

export const getServerSideProps: GetServerSideProps = async () => {
    try {
        const { data } = await API.getPopularPosts(1);

        return {
            props: {
                ...data.body
            }
        };
    } catch (error) {
        return { notFound: true };
    }
};

interface Props extends API.GetPostsResponseData {
    trendy?: API.GetPostsResponseData;
    page: number;
}

const TrendyArticles: PageComponent<Props> = () => {
    return <></>;
};

TrendyArticles.pageLayout = (page, props) => (
    <CollectionLayout active="인기 포스트" {...props}>
        {page}
    </CollectionLayout>
);

export default TrendyArticles;
