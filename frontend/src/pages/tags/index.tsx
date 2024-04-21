import type { GetServerSideProps } from 'next';
import { useEffect } from 'react';

import { Flex, Grid, Loading } from '~/components/design-system';
import { CollectionLayout } from '@system-design/article';
import type { PageComponent } from '~/components';
import { SEO } from '@system-design/shared';
import { TagCard } from '@system-design/tag';

import { useInfinityScroll } from '~/hooks/use-infinity-scroll';

import { CONFIG } from '~/modules/settings';
import { lazyLoadResource } from '~/modules/optimize/lazy';

import * as API from '~/modules/api';

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
    const { data: tags, isLoading } = useInfinityScroll({
        key: ['tags'],
        callback: async (nextPage) => {
            const { data } = await API.getTags(nextPage);
            return data.body.tags;
        },
        initialValue: props.tags,
        lastPage: props.lastPage
    });

    useEffect(lazyLoadResource, [tags]);

    return (
        <>
            <SEO
                title={`태그 클라우드 | ${CONFIG.BLOG_TITLE}`}
                description="태그 클라우드 페이지입니다. 다양한 분야의 주제를 만나보세요."
            />
            <Grid
                gap={3}
                column={{
                    desktop: 3,
                    tablet: 2,
                    mobile: 1
                }}>
                {tags.map((item) => (
                    <TagCard {...item} />
                ))}
            </Grid>
            {isLoading && (
                <Flex justify="center" className="mt-3">
                    <Loading position="inline" />
                </Flex>
            )}
        </>
    );
};

Tags.pageLayout = (page) => (
    <CollectionLayout active="Tags">
        {page}
    </CollectionLayout>
);

export default Tags;
