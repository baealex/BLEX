import Head from 'next/head';
import React from 'react';

import { ArticleCard } from '@components/article';
import {
    Footer,
    Pagination
} from '@components/shared';
import TopicsDesc from '@components/tag/TagDesc';
import Title from '@components/shared/Title';

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
                <Title text={props.tag}/>
                {props.descPosts.url && (
                    <TopicsDesc {...props.descPosts}/>
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