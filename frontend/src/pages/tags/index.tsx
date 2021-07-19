import React from 'react';
import Head from 'next/head';

import { TagCard } from '@components/tag';
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

            <div className="container">
                <div className="row">
                    {props.tags.map((item, idx) => (
                        <TagCard key={idx} {...item}/>
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