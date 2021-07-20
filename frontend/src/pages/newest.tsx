import React from 'react';
import Head from 'next/head';

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
                    <title>BLOG EXPRESS ME</title>
                </Head>

                <div className="container">
                    <div className="row">
                        {props.posts.map((item, idx) => (
                            <ArticleCard
                                key={idx}
                                className="col-lg-4 col-md-6 mt-4"
                                {...item}
                            />
                        ))}
                    </div>
                    <Pagination
                        page={props.page}
                        last={props.lastPage}
                    />
                </div>
                <Footer/>
            </>
        </>
    )
}