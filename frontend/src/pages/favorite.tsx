import type { GetServerSideProps } from 'next';

import { ArticleCard, ArticleCardGroup, CollectionLayout } from '~/components/system-design/article';
import type { PageComponent } from '~/components';

import { Flex, Loading, Text } from '~/components/design-system';
import { SEO } from '~/components/system-design/shared';

import { ServiceInfoWidget, TrendingPostsWidget } from '~/components/system-design/widgets';

import { useInfinityScroll } from '~/hooks/use-infinity-scroll';
import { useLikePost } from '~/hooks/use-like-post';

import { CONFIG } from '~/modules/settings';

import * as API from '~/modules/api';

type Props = API.GetFavoritePostsResponseData;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
    try {
        const { data } = await API.getFavoritePosts(1, context.req.headers.cookie);

        return { props: { ...data.body } };
    } catch (error) {
        return { notFound: true };
    }
};

const TrendyArticles: PageComponent<Props> = (props: Props) => {
    const { data: posts, mutate: setPosts, isLoading } = useInfinityScroll({
        key: ['article', 'favorite'],
        callback: async (nextPage) => {
            const { data } = await API.getFavoritePosts(nextPage);
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
                title={`관심 포스트 | ${CONFIG.BLOG_TITLE}`}
                description="내가 관심 있는 포스트 모음"
                url="https://blex.me/favorite"
                type="website"
                canonicalUrl="https://blex.me/favorite"
                twitterCard="summary"
                siteName="BLEX"
                structuredData={{
                    '@context': 'https://schema.org',
                    '@type': 'CollectionPage',
                    'name': `관심 포스트 | ${CONFIG.BLOG_TITLE}`,
                    'description': '내가 관심 있는 포스트 모음',
                    'url': 'https://blex.me/favorite'
                }}
            />

            <ArticleCardGroup hasDivider className="mt-4 mb-5" gap={5}>
                {posts.map((post) => (
                    <div key={post.url}>
                        <ArticleCard onLike={() => handleLike(post)} {...post} />
                        <Flex className="mt-3" align="center" justify="end">
                            <Text className="gray-dark" fontSize={3}>
                                {post.likedDate}에 추가됨
                            </Text>
                        </Flex>
                    </div>
                ))}
                {isLoading && (
                    <Flex justify="center" className="p-3">
                        <Loading position="inline" />
                    </Flex>
                )}
            </ArticleCardGroup>
        </>
    );
};

TrendyArticles.pageLayout = (page) => (
    <CollectionLayout
        active="Favorite"
        widget={(
            <>
                <TrendingPostsWidget />
                <ServiceInfoWidget />
            </>
        )}>
        {page}
    </CollectionLayout>
);

export default TrendyArticles;
