import {
    Footer,
    Pagination,
} from '@system-design/shared';
import {
    ArticleCard,
    CollectionLayout,
} from '@system-design/article';
import * as API from '@modules/api';

import { GetServerSidePropsContext } from 'next';

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const {
        page = 1
    } = context.query;
    
    try {
        const { data } = await API.getPopularPosts(Number(page));

        return {
            props: {
                ...data.body,
                page
            }
        };
    } catch(error) {
        return {
            notFound: true
        };
    }
}

interface Props extends API.GetPostsData {
    trendy?: API.GetPostsData,
    page: number;
}

export default function TrendyArticles(props: Props) {
    return (
        <>
            <Pagination
                page={props.page}
                last={props.lastPage}
            />
            <Footer/>
        </>
    );
}

TrendyArticles.pageLayout = (page: JSX.Element, props: Props) => (
    <CollectionLayout active="인기 포스트" {...props}>
        <div className="row">
            {props.posts.map((item, idx) => (
                <ArticleCard
                    key={idx}
                    className="col-lg-4 col-md-6 mt-4"
                    {...item}
                />
            ))}
        </div>
        {page}
    </CollectionLayout>
);