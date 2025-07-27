import React, { useEffect, useState } from 'react';
import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import Router from 'next/router';
import { useStore } from 'badland-react';

import { authorRenameCheck } from '~/modules/middleware/author';

import {
    ArticleAction,
    ArticleAuthor,
    ArticleComment,
    ArticleContent,
    ArticleCover,
    ArticleNav,
    ArticleSeries,
    ArticleThanks,
    RelatedArticles
} from '~/components/system-design/article-detail-page';
import {
    BadgeGroup,
    Button,
    Card,
    Container,
    Flex,
    SingleWidgetLayout,
    Text
} from '~/components/design-system';
import {
    Footer,
    SEO
} from '~/components/system-design/shared';

import * as API from '~/modules/api';
import { getPostImage } from '~/modules/utility/image';
import { snackBar } from '~/modules/ui/snack-bar';

import { authStore } from '~/stores/auth';
import { configStore } from '~/stores/config';

import { CONFIG } from '~/modules/settings';
import { GrowthArrow, Pencil, TrashCan } from '@baejino/icon';

interface Props {
    profile: API.GetUserProfileResponseData;
    post: API.GetAnUserPostsViewResponseData;
}

export const getServerSideProps: GetServerSideProps = async ({ req, query }) => {
    const { cookies } = req;
    configStore.serverSideInject(cookies);

    const { author = '', posturl = '' } = query as {
        [key: string]: string;
    };

    if (!author.startsWith('@') || !posturl) {
        return { notFound: true };
    }

    const { cookie } = req.headers;

    try {
        const [post, profile] = await Promise.all([
            API.getAnUserPostsView(author, posturl, cookie),
            API.getUserProfile(author, ['profile'])
        ]);
        API.postPostAnalytics(posturl, {
            user_agent: req.headers['user-agent'],
            referer: req.headers.referer ? req.headers.referer : '',
            ip: req.headers['x-real-ip'] || req.socket.remoteAddress,
            time: new Date().getTime()
        }, cookie).catch(console.error);
        return {
            props: {
                post: post.data.body,
                profile: profile.data.body
            }
        };
    } catch (error) {
        return await authorRenameCheck(error, {
            author,
            continuePath: `/${encodeURI(posturl)}`
        });
    }
};

function moveToHash() {
    const element = document.getElementById(decodeURIComponent(window.location.hash.replace('#', '')));

    if (element) {
        const offset = element.getBoundingClientRect().top + window.scrollY;
        window.scroll({
            top: offset - (window.scrollY < offset ? 15 : 90),
            left: 0
        });
    }
}

function PostDetail(props: Props) {
    const [{ username }] = useStore(authStore);

    const [countLikes, setCountLikes] = useState<number>(props.post.countLikes);
    const [isLike, setIsLike] = useState<boolean>(props.post.isLiked);

    useEffect(() => {
        if (countLikes !== props.post.countLikes) {
            setCountLikes(props.post.countLikes);
        }

        if (isLike !== props.post.isLiked) {
            setIsLike(props.post.isLiked);
        }

        moveToHash();
    }, [props.post.author, props.post.url]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.addEventListener('popstate', moveToHash);

            return () => {
                window.removeEventListener('popstate', moveToHash);
            };
        }
    }, []);

    const handleClickEdit = () => {
        const { author, url } = props.post;
        Router.push(`/@${author}/${url}/edit`);
    };

    const handleClickAnalytics = () => {
        const { author, url } = props.post;
        Router.push(`/@${author}/${url}/analytics`);
    };

    const handleClickDelete = async () => {
        if (confirm('😮 정말 이 포스트를 삭제할까요?')) {
            const { author, url } = props.post;

            const { data } = await API.deleteAnUserPosts('@' + author, url);
            if (data.status === 'DONE') {
                snackBar('😀 포스트가 삭제되었습니다.');
            }
        }
    };

    return (
        <>
            <SEO
                title={`${props.post.title} — ${props.post.author}`}
                description={props.post.description}
                author={props.post.author}
                keywords={props.post.tags}
                image={props.post.image && getPostImage(props.post.image)}
                imageAlt={`${props.post.title} 이미지`}
                url={`https://blex.me/@${props.post.author}/${props.post.url}`}
                type="article"
                publishedTime={props.post.createdDate}
                modifiedTime={props.post.updatedDate}
                canonicalUrl={`https://blex.me/@${props.post.author}/${props.post.url}`}
                twitterCard="summary_large_image"
                twitterCreator={`@${props.post.author}`}
                siteName="BLEX"
                structuredData={{
                    '@context': 'https://schema.org',
                    '@type': 'BlogPosting',
                    'headline': props.post.title,
                    'description': props.post.description,
                    'image': props.post.image && getPostImage(props.post.image),
                    'datePublished': props.post.createdDate,
                    'dateModified': props.post.updatedDate,
                    'author': {
                        '@type': 'Person',
                        'name': props.post.author,
                        'url': `https://blex.me/@${props.post.author}`
                    },
                    'publisher': {
                        '@type': 'Organization',
                        'name': 'BLEX',
                        'logo': {
                            '@type': 'ImageObject',
                            'url': 'https://blex.me/favicon.ico'
                        }
                    },
                    'mainEntityOfPage': {
                        '@type': 'WebPage',
                        '@id': `https://blex.me/@${props.post.author}/${props.post.url}`
                    },
                    'keywords': props.post.tags.join(', ')
                }}
            />
            <article data-clarity-region={CONFIG.MICROSOFT_CLARITY ? 'article' : undefined}>
                <ArticleCover
                    author={props.post.author}
                    series={props.post.series}
                    image={props.post.image}
                    title={props.post.title}
                    isAd={props.post.isAd}
                    createdDate={props.post.createdDate}
                />
                <Container size="lg">
                    <SingleWidgetLayout
                        widgetPosition="Left"
                        widget={(
                            <>
                                <ArticleAction {...props.post} />
                                <ArticleNav renderedContent={props.post.renderedContent} />
                            </>
                        )}>
                        {props.post.author == username && (
                            <Flex className="my-3" justify="between" align="center">
                                <Flex gap={2} align="center">
                                    <Button onClick={handleClickEdit}>
                                        <Flex align="center" gap={2}>
                                            <Pencil width={20} height={20} />
                                            수정
                                        </Flex>
                                    </Button>
                                    <Button onClick={handleClickAnalytics}>
                                        <Flex align="center" gap={2}>
                                            <GrowthArrow width={20} height={20} />
                                            분석
                                        </Flex>
                                    </Button>
                                </Flex>
                                <Button onClick={handleClickDelete}>
                                    <Flex align="center" gap={2}>
                                        <TrashCan width={20} height={20} />
                                        삭제
                                    </Flex>
                                </Button>
                            </Flex>
                        )}
                        <ArticleContent
                            className="article"
                            renderedContent={props.post.renderedContent}
                        />
                        <Card
                            isRounded
                            hasShadow
                            className="p-4 mt-4">
                            <Text fontSize={4} fontWeight={600} className="mb-3">
                                태그
                            </Text>
                            <BadgeGroup
                                items={props.post.tags.map(item => (
                                    <Link href={`/@${props.post.author}/posts/${item}`}>
                                        {item}
                                    </Link>
                                ))}
                            />
                        </Card>
                        <ArticleThanks
                            author={props.post.author}
                            url={props.post.url}
                        />
                        <ArticleSeries
                            author={props.post.author}
                            url={props.post.url}
                            series={props.post.series}
                        />
                        <ArticleComment
                            author={props.post.author}
                            url={props.post.url}
                            countComments={props.post.countComments}
                        />
                    </SingleWidgetLayout>
                </Container>
            </article>
            <Footer isDark>
                <Container size="md">
                    <ArticleAuthor {...props.profile} />
                    <RelatedArticles
                        author={props.post.author}
                        name={props.profile.profile.name}
                        bio={props.profile.profile.bio}
                        url={props.post.url}
                    />
                </Container>
            </Footer>
            <style jsx global>{`
                .post-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
                }
                
                @media (prefers-reduced-motion: reduce) {
                    .post-card, .featured-post, img {
                        transition: none !important;
                    }
                }
                
                /* Dark mode adjustments */
                body.dark .card {
                    background-color: #222;
                }
                
                body.dark .card:hover {
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                }
            `}</style>
        </>
    );
}

export default PostDetail;
