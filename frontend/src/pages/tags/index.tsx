import { useEffect, useState } from 'react';
import type { GetServerSideProps } from 'next';

import { Flex, Loading, Masonry } from '~/components/design-system';
import { CollectionLayout } from '@system-design/article';
import type { PageComponent } from '~/components';
import { SEO } from '@system-design/shared';
import { TagCard } from '@system-design/tag';

import * as API from '~/modules/api';
import { CONFIG } from '~/modules/settings';
import { lazyLoadResource } from '~/modules/optimize/lazy';

import { useInfinityScroll } from '~/hooks/use-infinity-scroll';
import { useMemoryStore } from '~/hooks/use-memory-store';

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
    const memoryStore = useMemoryStore(['tags'], {
        page: 1,
        tags: props.tags
    });

    const [page, setPage] = useState(memoryStore.page);
    const [tags, setTags] = useState(memoryStore.tags);

    const { isLoading } = useInfinityScroll(async () => {
        const { data } = await API.getTags(page + 1);

        if (data.status === 'DONE') {
            setPage((prevPage) => {
                memoryStore.page = prevPage + 1;
                return memoryStore.page;
            });
            setTags((prevTags) => {
                memoryStore.tags = [...prevTags, ...data.body.tags];
                return memoryStore.tags;
            });
        }
    }, { enabled: memoryStore.page < props.lastPage });

    useEffect(lazyLoadResource, [tags]);

    useEffect(() => {
        setPage(memoryStore.page);
        setTags(memoryStore.tags);
    }, [memoryStore]);

    return (
        <>
            <SEO
                title={`태그 클라우드 | ${CONFIG.BLOG_TITLE}`}
                description="태그 클라우드 페이지입니다. 다양한 분야의 주제를 만나보세요."
            />
            <Masonry
                items={tags.map((item) => (
                    <TagCard {...item} />
                ))}
            />
            {isLoading && (
                <Flex justify="center" className="mt-3">
                    <Loading position="inline" />
                </Flex>
            )}
        </>
    );
};

Tags.pageLayout = (page, props) => (
    <CollectionLayout active="태그 클라우드" {...props} posts={[]}>
        {page}
    </CollectionLayout>
);

export default Tags;
