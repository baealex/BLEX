import type { GetServerSideProps } from 'next';
import { useEffect } from 'react';

import { ArticleCard, CollectionLayout } from '@system-design/article';
import type { PageComponent } from '~/components';

import { Flex, Loading } from '~/components/design-system';
import { TrendingPostsWidget } from '~/components/system-design/widgets';

import { useInfinityScroll } from '~/hooks/use-infinity-scroll';
import { useLikePost } from '~/hooks/use-like-post';

import { lazyLoadResource } from '~/modules/optimize/lazy';

import * as API from '~/modules/api';


type Props = API.GetPostsResponseData;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
    try {
        const { data } = await API.getNewestPosts(1, context.req.headers.cookie);

        return {
            props: {
                ...data.body
            }
        };
    } catch (error) {
        return { notFound: true };
    }
};

const TrendyArticles: PageComponent<Props> = (props: Props) => {
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
            {posts.map((post) => (
                <ArticleCard
                    key={post.url}
                    className="mb-4"
                    hasShadow={false}
                    isRounded={false}
                    onLike={() => handleLike(post)}
                    {...post}
                />
            ))}
            {isLoading && (
                <Flex justify="center" className="p-3">
                    <Loading position="inline" />
                </Flex>
            )}
        </>
    );
};

TrendyArticles.pageLayout = (page) => (
    <CollectionLayout
        active="Home"
        widget={(
            <TrendingPostsWidget />
        )}>
        {page}
    </CollectionLayout >
);

export default TrendyArticles;
