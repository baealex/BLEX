import type { GetServerSideProps } from 'next';

import {
    Pagination,
    SEO
} from '@system-design/shared';
import { CollectionLayout } from '@system-design/article';
import type { PageComponent } from '~/components';
import { TagCard } from '@system-design/tag';

import * as API from '~/modules/api';
import { Masonry } from '~/components/design-system';

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
            <SEO
                title={'태그 클라우드 | BLEX'}
                image="https://static.blex.me/assets/images/default-post.png"
                description="태그 클라우드 페이지입니다. 다양한 분야의 태그를 만나보세요."
            />
            <Pagination
                page={props.page}
                last={props.lastPage}
            />
        </>
    );
};

Tags.pageLayout = (page, props) => (
    <CollectionLayout active="태그 클라우드" {...props} posts={[]}>
        <>
            <Masonry
                items={props.tags.map((item) => (
                    <TagCard {...item} />
                ))}
            />
            {page}
        </>
    </CollectionLayout>
);

export default Tags;