import { useEffect, useState } from 'react';
import type { GetServerSideProps } from 'next';
import Link from 'next/link';

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

import * as API from '~/modules/api';
import { CONFIG } from '~/modules/settings';
import { getUserImage } from '~/modules/utility/image';
import { lazyLoadResource } from '~/modules/optimize/lazy';
import { snackBar } from '~/modules/ui/snack-bar';

import { useInfinityScroll } from '~/hooks/use-infinity-scroll';
import { useMemoryStore } from '~/hooks/use-memory-store';

import { modalStore } from '~/stores/modal';

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

    const handleLike = async (post: API.GetTagResponseData['posts'][number]) => {
        const { data } = await API.putAnUserPosts('@' + post.author, post.url, 'like');
        if (data.status === 'DONE') {
            if (typeof data.body.countLikes === 'number') {
                setPosts((prevState) => prevState.map((_post) => {
                    if (_post.url === post.url) {
                        _post.hasLiked = !_post.hasLiked;
                        _post.countLikes = data.body.countLikes as number;
                    }
                    return _post;
                }));
            }
        }
        if (data.status === 'ERROR') {
            if (data.errorCode === API.ERROR.NEED_LOGIN) {
                snackBar('😅 로그인이 필요합니다.', {
                    onClick: () => {
                        modalStore.open('isOpenAuthGetModal');
                    }
                });
            }
        }
    };

    useEffect(lazyLoadResource, [posts]);

    useEffect(() => {
        setPage(memoryStore.page);
        setPosts(memoryStore.posts);
    }, [memoryStore]);

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
