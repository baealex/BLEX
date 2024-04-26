import type { GetServerSideProps } from 'next';
import Link from 'next/link';

import {
    Breadcrumb,
    Container,
    Flex,
    Loading,
    SpeechBubble
} from '@design-system';

import { ArticleCard, ArticleCardGroup } from '@system-design/article';
import { Footer, SEO } from '@system-design/shared';

import { useInfinityScroll } from '~/hooks/use-infinity-scroll';

import * as API from '~/modules/api';
import { CONFIG } from '~/modules/settings';
import { getUserImage } from '~/modules/utility/image';

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
        key: ['tags', props.tag],
        callback: async (nextPage) => {
            const { data } = await API.getTag(props.tag, nextPage);
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

    return (
        <>
            <SEO
                title={`태그 - ${props.tag} | ${CONFIG.BLOG_TITLE}`}
                description={props.headPost
                    ? props.headPost.description
                    : `${props.tag} 주제로 작성된 포스트를 모아 볼 수 있는 페이지입니다. 다양한 분야의 포스트를 만나보세요.`}
            />
            <Container size="sm">
                <Breadcrumb
                    className="mb-4"
                    current={props.tag}
                    depths={[
                        {
                            label: 'Home',
                            url: '/'
                        },
                        {
                            label: 'Tags',
                            url: '/tags'
                        },
                        {
                            label: props.tag,
                            url: `/tags/${props.tag}`
                        }
                    ]}
                />
                {props.headPost && (
                    <div className="mt-3 mb-5">
                        <SpeechBubble
                            image={(
                                <Link href={`/@${props.headPost.author}`}>
                                    <img className="rounded-full" src={getUserImage(props.headPost.authorImage)} />
                                </Link>
                            )}>
                            <Link className="deep-dark" href={`/@${props.headPost.author}/${props.headPost.url}`}>
                                {props.headPost.description}
                            </Link>
                        </SpeechBubble>
                    </div>
                )}
                <ArticleCardGroup hasDivider gap={5}>
                    {posts.map((item, idx) => (
                        <ArticleCard
                            key={idx}
                            {...item}
                            onLike={() => handleLike(item)}
                        />
                    ))}
                </ArticleCardGroup>
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
