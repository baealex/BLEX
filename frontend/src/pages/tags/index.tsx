import React from 'react';
import Head from 'next/head';

import { Layout } from '@components/article/collection';
import { ArticleCard } from '@components/article';
import {
    Footer,
    Pagination
} from '@components/shared';

import * as API from '@modules/api';

import { GetServerSidePropsContext } from 'next';

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const {
        page = 1
    } = context.query;
    
    const { data } = await API.getTags(Number(page));
    return {
        props: {
            ...data.body,
            page
        }
    }
}

interface Props extends API.GetTagsData {
    page: number;
}

export default function Tags(props: Props) {

    return (
        <>
            <Head>
                <title>태그 클라우드 — BLEX</title>
            </Head>
            <Pagination
                page={props.page}
                last={props.lastPage}
            />
            <Footer/>
        </>
    )
}

Tags.pageLayout = (page: JSX.Element, props: Props) => (
    <Layout active="태그 클라우드" {...props}>
        <>
            <div className="row">
                {props.tags.map((item, idx) => (
                    <ArticleCard
                        key={idx}
                        className="col-lg-4 col-md-6 mt-4"
                        title={`${item.name} (${item.count})`}
                        url={`/tags/${item.name}`}
                        {...item}
                    />
                ))}
            </div>
            {page}
        </>
    </Layout>
)