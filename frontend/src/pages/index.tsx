import type { GetServerSideProps } from 'next';

import { ArticleCard, ArticleCardGroup, CollectionLayout } from '@system-design/article';
import type { PageComponent } from '~/components';

import { Flex, Loading } from '~/components/design-system';

import { ServiceInfoWidget, TrendingPostsWidget } from '~/components/system-design/widgets';

import { useInfinityScroll } from '~/hooks/use-infinity-scroll';
import { useLikePost } from '~/hooks/use-like-post';

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

    return (
        <ArticleCardGroup className="mt-4 mb-5" gap={5}>
            {posts.map((post) => (
                <ArticleCard
                    key={post.url}
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
        </ArticleCardGroup>
    );
};

TrendyArticles.pageLayout = (page) => (
    <CollectionLayout
        active="Home"
        widget={(
            <>
                <TrendingPostsWidget />
                <ServiceInfoWidget />
            </>
        )}>
        {page}
    </CollectionLayout >
);

export default TrendyArticles;
