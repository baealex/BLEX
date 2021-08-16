import { ArticleCard } from '@components/article';
import { Layout } from '@components/article/collection';
import {
    Adsense,
    Footer,
    PageNavigation,
    Pagination,
} from '@components/shared';
import { CONFIG } from '@modules/settings';

import * as API from '@modules/api';

import { GetServerSidePropsContext } from 'next';

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const {
        page = 1
    } = context.query;
    
    try {
        const { data } = await API.getPosts('newest', Number(page));

        if (page === 1) {
            const trendy = await API.getTrendyTopPosts();
            return {
                props: {
                    trendy: trendy.data.body,
                    ...data.body,
                    page
                }
            }
        }
        return {
            props: {
                ...data.body,
                page
            }
        }
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
            <>
                <Pagination
                    page={props.page}
                    last={props.lastPage}
                />
                <Footer/>
            </>
        </>
    )
}

TrendyArticles.pageLayout = (page: JSX.Element, props: Props) => (
    <>
        {props.trendy && props.trendy.posts.length > 0 && (
            <>
                <div className="container mb-5">
                    <PageNavigation
                        disableLink
                        items={[{name: '주간 트랜드'}]}
                        active="주간 트랜드"
                    />
                    <div className="row">
                        {props.trendy.posts.map((item, idx) => (
                            <ArticleCard
                                key={idx}
                                number={idx + 1}
                                hasShadow={false}
                                className="col-lg-4 col-md-6 mt-4"
                                {...item}
                                title={item.title}
                            />
                        ))}
                    </div>
                </div>
                {CONFIG.GOOGLE_ADSENSE_CLIENT_ID && (
                    <div className="container mb-5">
                        <Adsense
                            client={CONFIG.GOOGLE_ADSENSE_CLIENT_ID}
                            slot="4684069321"
                            format="auto"
                            responsive="true"
                        />
                    </div>
                )}
            </>
        )}
        <Layout active="최신 포스트" {...props}>
            <>
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
            </>
        </Layout>
    </>
)