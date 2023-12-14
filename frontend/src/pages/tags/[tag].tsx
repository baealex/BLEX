import { useEffect, useState } from 'react';
import type { GetServerSideProps } from 'next';
import Link from 'next/link';

import {
    Loading,
    Masonry,
    SpeechBubble,
    Text
} from '@design-system';

import {
    Footer,
    SEO
} from '@system-design/shared';
import { ArticleCard } from '@system-design/article';

import * as API from '~/modules/api';
import { CONFIG } from '~/modules/settings';
import { getUserImage } from '~/modules/utility/image';
import { lazyLoadResource } from '~/modules/optimize/lazy';

import { useInfinityScroll } from '~/hooks/use-infinity-scroll';
import { useMemoryStore } from '~/hooks/use-memory-store';

export const getServerSideProps: GetServerSideProps = async (context) => {
    const {
        tag,
        page = 1
    } = context.query;

    try {
        const { data } = await API.getTag(String(tag), Number(page));
        return {
            props: {
                ...data.body,
                tag,
                page
            }
        };
    } catch (error) {
        return { notFound: true };
    }
};

interface Props extends API.GetTagResponseData {
    tag: string;
    page: number;
}

export default function TagDetail(props: Props) {
    const memoryStore = useMemoryStore(['article', props.tag], {
        page: 1,
        posts: props.posts
    });

    const [page, setPage] = useState(memoryStore.page);
    const [posts, setPosts] = useState(memoryStore.posts);

    const { isLoading } = useInfinityScroll(async () => {
        const { data } = await API.getTag(props.tag, page + 1);

        if (data.status === 'DONE') {
            setPage((prevPage) => {
                memoryStore.page = prevPage + 1;
                return memoryStore.page;
            });
            setPosts((prevPosts) => {
                memoryStore.posts = [...prevPosts, ...data.body.posts];
                return memoryStore.posts;
            });
        }
    }, { enabled: memoryStore.page < props.lastPage });

    useEffect(lazyLoadResource, [posts]);

    useEffect(() => {
        setPage(memoryStore.page);
        setPosts(memoryStore.posts);
    }, [memoryStore]);

    return (
        <>
            <SEO
                title={`${props.tag} | ${CONFIG.BLOG_TITLE}`}
                description={props.headPost
                    ? props.headPost.description
                    : `블렉스에서 '${props.tag}' 주제로 작성된 모든 포스트 만나보세요.`}
            />
            <div className="container">
                <Text fontSize={8} fontWeight={600}>— {props.tag} —</Text>
                {props.headPost && (
                    <div className="mt-3">
                        <SpeechBubble
                            href={`/@${props.headPost.author}`}
                            alt={props.headPost.author}
                            src={getUserImage(props.headPost.authorImage)}>
                            {props.headPost.description}
                            <Link className="ml-1 shallow-dark" href={`/@${props.headPost.author}/${props.headPost.url}`}>
                                더보기
                            </Link>
                        </SpeechBubble>
                    </div>
                )}
                <Masonry
                    items={posts.map((item, idx) => (
                        <ArticleCard
                            key={idx}
                            {...item}
                        />
                    ))}
                />
                {isLoading && (
                    <div className="d-flex justify-content-center p-3">
                        <Loading position="inline" />
                    </div>
                )}
            </div >
            <Footer />
        </>
    );
}
