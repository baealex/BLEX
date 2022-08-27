import type { GetServerSideProps } from 'next';

import {
    ArticleCard,
    CollectionLayout
} from '@system-design/article';
import {
    Footer,
    Pagination,
    SEO
} from '@system-design/shared';
import { Card } from '@design-system';
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
            <Footer/>
        </>
    );
};

TrendyArticles.pageLayout = (page, props) => (
    <CollectionLayout active="인기 포스트" {...props}>
        <div className="mt-4">
            <Card hasBackground isRounded className="p-3">
                30일간 '추천'과 '도움됐어요'가 눌러진 횟수를 기준으로 정렬했어요!
            </Card>
        </div>
        <div className="row">
            {props.posts.map(item => (
                <ArticleCard
                    key={item.url}
                    className="col-lg-4 col-md-6 mt-4"
                    {...item}
                />
            ))}
        </div>
        {page}
    </CollectionLayout>
);

export default TrendyArticles;
