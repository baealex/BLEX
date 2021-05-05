import Head from 'next/head';
import React from 'react';

import ArticleCard from '@components/article/ArticleCard';
import PageNav from '@components/common/PageNav';
import TopicsDesc from '@components/tag/TagDesc';
import Title from '@components/common/Title';

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

                <PageNav
                    page={props.page}
                    last={props.lastPage}
                />
            </div>
        </>
    )
}