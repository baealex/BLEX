import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { useEffect } from 'react';

import {
    Container,
    Flex,
    Loading,
    SpeechBubble,
    Text
} from '@design-system';

import {
    Footer,
    SEO
} from '@system-design/shared';
import { ArticleCard } from '@system-design/article';

import { useInfinityScroll } from '~/hooks/use-infinity-scroll';

import * as API from '~/modules/api';
import { CONFIG } from '~/modules/settings';
import { getUserImage } from '~/modules/utility/image';
import { lazyLoadResource } from '~/modules/optimize/lazy';

import { useLikePost } from '~/hooks/use-like-post';

export const getServerSideProps: GetServerSideProps = async (context) => {
    const {
        tag,
        page = 1
    } = context.query;

    try {
        const { data } = await API.getTag(String(tag), Number(page), context.req.headers.cookie);
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
    const { data: posts, mutate: setPosts, isLoading } = useInfinityScroll({
        key: ['article'],
        callback: async (nextPage) => {
            const { data } = await API.getNewestPosts(nextPage);
            return data.body.posts;
        },
        initialValue: props.posts,
        lastPage: props.lastPage
    });

    const handleLike = useLikePost({
        onLike: (post, countLikes) => {
            setPosts((prevPosts) => prevPosts.map((_post) => {
                if (_post.url === post.url) {
                    return {
                        ..._post,
                        countLikes,
                        hasLiked: !_post.hasLiked
                    };
                }
                return _post;
            }));
        }
    });

    useEffect(lazyLoadResource, [posts]);

    return (
        <>
            <SEO
                title={`태그 - ${props.tag} | ${CONFIG.BLOG_TITLE}`}
                description={props.headPost
                    ? props.headPost.description
                    : `${props.tag} 주제로 작성된 포스트를 모아 볼 수 있는 페이지입니다. 다양한 분야의 포스트를 만나보세요.`}
            />
            <Container size="sm">
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
                <div className="mt-4">
                    {posts.map((item, idx) => (
                        <ArticleCard
                            key={idx}
                            className="mb-4"
                            {...item}
                            onLike={() => handleLike(item)}
                        />
                    ))}
                </div>
                {isLoading && (
                    <Flex justify="center" className="p-3">
                        <Loading position="inline" />
                    </Flex>
                )}
            </Container>
            <Footer />
        </>
    );
}
