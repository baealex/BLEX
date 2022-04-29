import Head from 'next/head';

import type { GetServerSidePropsContext } from 'next';

import {
    Footer,
    Pagination,
    SEO,
} from '@system-design/shared';
import { CollectionLayout, } from '@system-design/article';
import { TagCard, } from '@system-design/tag';

import * as API from '@modules/api';

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const { page = 1 } = context.query;
    
    try {
        const { data } = await API.getTags(Number(page));
        return {
            props: {
                ...data.body,
                page
            }
        };
    } catch (error) {
        return {
            notFound: true
        };
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
            <SEO
                title="태그 클라우드"
                image="https://static.blex.me/assets/images/default-post.png"
                description="블렉스에 존재하는 모든 태그를 한눈에 살펴보세요."
            />
            <Pagination
                page={props.page}
                last={props.lastPage}
            />
            <Footer/>
        </>
    );
}

Tags.pageLayout = (page: JSX.Element, props: Props) => (
    <CollectionLayout active="태그 클라우드" {...props}>
        <>
            <div className="row">
                {props.tags.map((item, idx) => (
                    <TagCard key={idx} {...item}/>
                ))}
            </div>
            {page}
        </>
    </CollectionLayout>
);