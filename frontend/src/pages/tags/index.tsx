import type { GetServerSideProps } from 'next';
import Head from 'next/head';

import {
    Footer,
    Pagination,
    SEO
} from '@system-design/shared';
import { CollectionLayout } from '@system-design/article';
import type { PageComponent } from '@components';
import { TagCard } from '@system-design/tag';

import * as API from '@modules/api';

export const getServerSideProps: GetServerSideProps = async (context) => {
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
        return { notFound: true };
    }
};

interface Props extends API.GetTagsResponseData {
    page: number;
}

const Tags: PageComponent<Props> = (props) => {

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
};

Tags.pageLayout = (page, props) => (
    <CollectionLayout active="태그 클라우드" {...props}>
        <>
            <div className="row">
                {props.tags.map((item) => (
                    <div key={item.name} className="col-sm-6 col-md-4 col-lg-3">
                        <TagCard {...item}/>
                    </div>
                ))}
            </div>
            {page}
        </>
    </CollectionLayout>
);

export default Tags;