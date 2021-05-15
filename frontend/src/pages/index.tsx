import Head from 'next/head';

import { ArticleCard } from '@components/article';
import PageNav from '@components/common/PageNav';
import Footer from '@components/common/Footer';

import * as API from '@modules/api';

import { GetServerSidePropsContext } from 'next';

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const {
        page = 1
    } = context.query;
    
    try {
        const { data } = await API.getPosts('trendy', Number(page));
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
    page: number;
}

export default function TrendyArticles(props: Props) {
    return (
        <>
            <>
                <Head>
                    <title>BLOG EXPRESS ME</title>
                </Head>

                <div className="container">
                    <div className="row">
                        {props.posts.map((item, idx) => (
                            <ArticleCard key={idx} {...item}/>
                        ))}
                    </div>

                    <PageNav
                        page={props.page}
                        last={props.lastPage}
                    />
                </div>
                <Footer/>
            </>
        </>
    )
}