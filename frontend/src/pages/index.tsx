import type { GetServerSideProps } from 'next';

import {
    ArticleCard,
    CollectionLayout
} from '@system-design/article';
import {
    Pagination,
    SEO
} from '@system-design/shared';
import type { PageComponent } from '~/components';

import * as API from '~/modules/api';

export const getServerSideProps: GetServerSideProps = async (context) => {
    const { page = 1 } = context.query;

    try {
        const { data } = await API.getPopularPosts(Number(page));

        return {
            props: {
                ...data.body,
                page
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

const TrendyArticles: PageComponent<Props> = (props) => {
    return (
        <>
            {props.page > 1 && (
                <SEO title={`인기 포스트 | ${props.page} 페이지`}/>
            )}
            <Pagination
                page={props.page}
                last={props.lastPage}
            />
        </>
    );
};

TrendyArticles.pageLayout = (page, props) => (
    <CollectionLayout active="인기 포스트" {...props}>
        {page}
    </CollectionLayout>
);

export default TrendyArticles;
