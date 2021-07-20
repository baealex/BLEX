import Head from 'next/head';
import React from 'react';

import { ArticleCard } from '@components/article';
import {
    Footer,
    Pagination
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

export default function Tag(props: Props) {
    return (
        <>
            <Head>
                <title>{props.tag} —  BLEX</title>
            </Head>

            <div className="container">
                <h1 className="h4 font-weight-bold pt-5">
                    — {props.tag} —
                </h1>
                {props.descPosts.url && (
                    <TagWiki {...props.descPosts}/>
                )}
                <div className="row">
                    {props.posts.map((item, idx) => (
                        <ArticleCard key={idx} {...item}/>
                    ))}
                </div>

                <Pagination
                    page={props.page}
                    last={props.lastPage}
                />
            </div>
            <Footer/>
        </>
    )
}