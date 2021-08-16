import Head from 'next/head';
import React from 'react';

import { Layout } from '@components/article/collection';
import { ArticleCard } from '@components/article';
import {
    Footer,
    Pagination,
    SEO
} from '@components/shared';
import { TagWiki } from '@components/tag';

import * as API from '@modules/api';

import { GetServerSidePropsContext } from 'next';

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const {
        tag,
        page = 1
    } = context.query;
    
    try {
        const { data } = await API.getTag(tag as string, Number(page));
        return {
            props: {
                ...data.body,
                page,
            }
        }
    } catch(error) {
        return {
            notFound: true
        };
    }
}

interface Props extends API.GetTagData {
    page: number;
}

export default function TagDetail(props: Props) {
    return (
        <>
            <Head>
                <title>{props.tag} —  BLEX</title>
            </Head>
            <SEO
                title={props.tag}
                image="https://static.blex.me/assets/images/default-post.png"
                description={`블렉스에서 '${props.tag}' 주제로 작성된 모든 포스트 만나보세요.`}
            />
            
                <Pagination
                    page={props.page}
                    last={props.lastPage}
                />
            <Footer/>
        </>
    )
}

TagDetail.pageLayout = (page: JSX.Element, props: Props) => (
    <Layout
        active={props.tag}
        {...props}
        itemExpended={(tags) => [
            ...tags,
            {
                name: props.tag,
                link: `/tags/${props.tag}`
            }
        ]}
    >
        <>
            {props.descPosts.url && (
                <TagWiki {...props.descPosts}/>
            )}
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