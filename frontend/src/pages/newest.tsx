import type { GetServerSideProps } from 'next';

import {
    ArticleCard,
    CollectionLayout
} from '@system-design/article';
import {
    Footer,
    Pagination
} from '@system-design/shared';
import type { PageComponent } from '@components';

import * as API from '@modules/api';

export const getServerSideProps: GetServerSideProps = async (context) => {
    const { page = 1 } = context.query;

    try {
        const { data } = await API.getNewestPosts(Number(page));

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

interface Props extends API.GetPostsData {
    trendy?: API.GetPostsData,
    page: number;
}

const TrendyArticles: PageComponent<Props> = (props) => {
    return (
        <>
            <Pagination
                page={props.page}
                last={props.lastPage}
            />
            <Footer/>
        </>
    );
};

TrendyArticles.pageLayout = (page, props) => (
    <CollectionLayout active="최신 포스트" {...props}>
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