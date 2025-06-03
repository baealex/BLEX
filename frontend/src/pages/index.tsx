import type { GetServerSideProps } from 'next';
import Link from 'next/link';

import { CollectionLayout } from '~/components/system-design/article';
import type { PageComponent } from '~/components';

import {
    Badge,
    Card,
    Flex,
    LazyLoadedImage,
    Loading,
    Masonry,
    Text
} from '~/components/design-system';

import { useInfinityScroll } from '~/hooks/use-infinity-scroll';
import { useLikePost } from '~/hooks/use-like-post';

import * as API from '~/modules/api';
import { getPostImage, getUserImage } from '~/modules/utility/image';

type Props = API.GetPostsResponseData;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
    try {
        const { data } = await API.getNewestPosts(1, context.req.headers.cookie);

        return { props: { ...data.body } };
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

    const featuredPost = posts.length > 0 ? posts[0] : null;
    const remainingPosts = posts.length > 0 ? posts.slice(1) : [];

    return (
        <>
            {featuredPost && (
                <div
                    className="featured-post mb-5"
                    style={{
                        position: 'relative',
                        borderRadius: '24px',
                        overflow: 'hidden',
                        marginTop: '20px',
                        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
                        transition: 'transform 0.3s ease'
                    }}>
                    <div
                        style={{
                            position: 'relative',
                            height: '500px',
                            width: '100%',
                            overflow: 'hidden'
                        }}>
                        <LazyLoadedImage
                            alt={featuredPost.title}
                            src={getPostImage(featuredPost.image || '', { minify: false })}
                            previewImage={getPostImage(featuredPost.image || '', { preview: true })}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                filter: 'brightness(0.7)',
                                transition: 'transform 0.5s ease'
                            }}
                        />
                        <div
                            style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                padding: '40px',
                                background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)',
                                color: 'white'
                            }}>
                            <Badge
                                style={{
                                    background: 'linear-gradient(90deg, #4568dc, #b06ab3)',
                                    color: 'white',
                                    marginBottom: '12px'
                                }}>
                                <Text fontSize={2} fontWeight={600}>Featured</Text>
                            </Badge>
                            <Link href={`/@${featuredPost.author}/${featuredPost.url}`}>
                                <Text
                                    tag="h2"
                                    fontSize={6}
                                    fontWeight={700}
                                    className="mb-3"
                                    style={{
                                        color: 'white',
                                        textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                                    }}>
                                    {featuredPost.title}
                                </Text>
                            </Link>
                            <Text fontSize={3} className="mb-4">
                                <Link href={`/@${featuredPost.author}/${featuredPost.url}`} style={{ color: 'rgba(255,255,255,0.9)' }}>
                                    {featuredPost.description}
                                </Link>
                            </Text>
                            <Flex align="center" gap={2}>
                                <Link href={`/@${featuredPost.author}`} style={{ color: 'white' }}>
                                    <img
                                        alt={featuredPost.author}
                                        src={getUserImage(featuredPost.authorImage || '')}
                                        style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '50%',
                                            border: '2px solid white'
                                        }}
                                    />
                                </Link>
                                <div>
                                    <Text fontSize={3} fontWeight={600}>
                                        <Link href={`/@${featuredPost.author}`} style={{ color: 'white' }}>
                                            @{featuredPost.author}
                                        </Link>
                                    </Text>
                                    <Text fontSize={2} style={{ color: 'rgba(255,255,255,0.8)' }}>
                                        {featuredPost.createdDate} · {featuredPost.readTime}분 분량
                                    </Text>
                                </div>
                                <div style={{ marginLeft: 'auto' }}>
                                    <Flex align="center" gap={3}>
                                        <button
                                            onClick={() => handleLike(featuredPost)}
                                            style={{
                                                background: 'rgba(255,255,255,0.2)',
                                                border: 'none',
                                                borderRadius: '50%',
                                                width: '40px',
                                                height: '40px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                color: featuredPost.hasLiked ? '#ff6b6b' : 'white',
                                                transition: 'all 0.2s ease'
                                            }}>
                                            {featuredPost.hasLiked ? (
                                                <i className="fas fa-heart" />
                                            ) : (
                                                <i className="far fa-heart" />
                                            )}
                                        </button>
                                        <Text fontSize={3} style={{ color: 'white' }}>
                                            {featuredPost.countLikes}
                                        </Text>
                                    </Flex>
                                </div>
                            </Flex>
                        </div>
                    </div>
                </div>
            )}

            <Text
                tag="h2"
                fontSize={5}
                fontWeight={700}
                className="mb-4"
                style={{
                    background: 'linear-gradient(90deg, #4568dc, #b06ab3)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                }}>
                Latest Articles
            </Text>

            <Masonry>
                {remainingPosts.map((post) => (
                    <Card
                        key={post.url}
                        className="post-card"
                        style={{
                            borderRadius: '16px',
                            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                            overflow: 'hidden',
                            height: '100%'
                        }}>
                        {post.image && (
                            <div
                                style={{
                                    position: 'relative',
                                    height: '200px',
                                    overflow: 'hidden'
                                }}>
                                <Link href={`/@${post.author}/${post.url}`}>
                                    <LazyLoadedImage
                                        alt={post.title}
                                        src={getPostImage(post.image || '', { minify: true })}
                                        previewImage={getPostImage(post.image || '', { preview: true })}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            transition: 'transform 0.5s ease'
                                        }}
                                    />
                                </Link>
                            </div>
                        )}
                        <div style={{ padding: '20px' }}>
                            <Flex align="center" gap={1} className="mb-2">
                                <Link href={`/@${post.author}`}>
                                    <img
                                        alt={post.author}
                                        src={getUserImage(post.authorImage || '')}
                                        style={{
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '50%'
                                        }}
                                    />
                                </Link>
                                <Text fontSize={2}>
                                    <Link className="shallow-dark" href={`/@${post.author}`}>{post.author}</Link>
                                </Text>
                                <Text fontSize={2} className="shallow-dark">·</Text>
                                <Text fontSize={2} className="shallow-dark">
                                    {post.createdDate}
                                </Text>
                            </Flex>

                            <Text tag="h3" fontSize={4} fontWeight={600} className="mb-2">
                                <Link className="deep-dark" href={`/@${post.author}/${post.url}`}>{post.title}</Link>
                            </Text>

                            <Text
                                fontSize={2}
                                className="shallow-dark mb-3"
                                style={{
                                    overflow: 'hidden',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical'
                                }}>
                                {post.description}
                            </Text>

                            <Flex justify="between" align="center">
                                {post.series && (
                                    <Link href={`/@${post.author}/series/${post.series.url}`}>
                                        <Badge isRounded>
                                            <Text fontSize={2}>
                                                {post.series.name}
                                            </Text>
                                        </Badge>
                                    </Link>
                                )}

                                <Flex align="center" gap={3} style={{ marginLeft: 'auto' }}>
                                    <Flex align="center" gap={1}>
                                        <i className="far fa-comment" style={{ color: '#999' }} />
                                        <Text fontSize={2} className="shallow-dark">{post.countComments}</Text>
                                    </Flex>
                                    <Flex align="center" gap={1}>
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleLike(post);
                                            }}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                padding: 0,
                                                cursor: 'pointer',
                                                color: post.hasLiked ? '#ff6b6b' : '#999'
                                            }}>
                                            {post.hasLiked ? (
                                                <i className="fas fa-heart" />
                                            ) : (
                                                <i className="far fa-heart" />
                                            )}
                                        </button>
                                        <Text fontSize={2} className="shallow-dark">{post.countLikes}</Text>
                                    </Flex>
                                </Flex>
                            </Flex>
                        </div>
                    </Card>
                ))}
            </Masonry>

            {isLoading && (
                <Flex justify="center" className="p-3 mb-4">
                    <Loading position="inline" />
                </Flex>
            )}
        </>
    );
};

TrendyArticles.pageLayout = (page) => (
    <CollectionLayout active="Home">
        <style jsx global>{`
            .post-card:hover {
                transform: translateY(-5px);
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
            }
            
            .post-card:hover img {
                transform: scale(1.05);
            }
            
            .featured-post:hover {
                transform: translateY(-5px);
            }
            
            .featured-post:hover img {
                transform: scale(1.05);
            }
            
            @media (prefers-reduced-motion: reduce) {
                .post-card, .featured-post, img {
                    transition: none !important;
                }
            }
            
            /* Dark mode adjustments */
            :global(body.dark) .sticky-header.scrolled {
                background-color: rgba(18, 18, 18, 0.8);
            }
        `}</style>
        {page}
    </CollectionLayout>
);

export default TrendyArticles;
