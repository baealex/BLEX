import React from 'react';
import Head from 'next/head';

import { ArticleCard } from '@components/article';
import { Layout } from '@components/article/collection';
import {
    Footer,
    Pagination,
    SEO
} from '@components/shared';

import * as API from '@modules/api';

import { GetServerSidePropsContext } from 'next';

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const {
        page = 1
    } = context.query;
    
    try {
        const { data } = await API.getPosts('newest', Number(page));
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

export default function NewestArticles(props: Props) {
    return (
        <>
            <>
                <Head>
                    <title>최신 포스트 — BLEX</title>
                </Head>
                <SEO
                    title="최신 포스트"
                    image="https://static.blex.me/assets/images/default-post.png"
                    description="블렉스에서 지금 막 작성된 따끈한 포스트들을 만나보세요."
                />
                <Pagination
                    page={props.page}
                    last={props.lastPage}
                />
                <Footer/>
            </>
        </>
    )
}

NewestArticles.pageLayout = (page: JSX.Element, props: Props) => (
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
)