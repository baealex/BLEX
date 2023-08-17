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
    ArticleLayout,
    ArticleNav,
    ArticleSeries,
    ArticleThanks,
    RelatedArticles
} from '@system-design/article-detail-page';
import { Button, Card, Text } from '@design-system';
import {
    Footer,
    SEO
} from '@system-design/shared';
import { TagBadges } from '@system-design/tag';

import * as API from '~/modules/api';
import { codeMirrorAll } from '~/modules/library/codemirror';
import { getPostsImage } from '~/modules/utility/image';
import { lazyLoadResource } from '~/modules/optimize/lazy';
import { snackBar } from '~/modules/ui/snack-bar';

import { authStore } from '~/stores/auth';
import { configStore } from '~/stores/config';

import { CONFIG } from '~/modules/settings';

interface Props {
    profile: API.GetUserProfileResponseData;
    post: API.GetAnUserPostsViewResponseData;
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ req, query }) => {
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

    const [likes, setLikes] = useState<number>(props.post.totalLikes);
    const [isLike, setIsLike] = useState<boolean>(props.post.isLiked);

    useEffect(() => {
        if (likes !== props.post.totalLikes) {
            setLikes(props.post.totalLikes);
        }

        if (isLike !== props.post.isLiked) {
            setIsLike(props.post.isLiked);
        }

        moveToHash();
        codeMirrorAll();
        lazyLoadResource();
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
                keywords={props.post.tags.join(',')}
                image={props.post.image && getPostsImage(props.post.image)}
                isArticle={true}
            />
            <article data-clarity-region={CONFIG.MICROSOFT_CLARITY ? 'article' : undefined}>
                <ArticleCover
                    author={props.post.author}
                    series={props.post.seriesName}
                    seriesUrl={props.post.series}
                    image={props.post.image}
                    title={props.post.title}
                    isAd={props.post.isAd}
                    createdDate={props.post.createdDate}
                />
                <ArticleLayout
                    action={<ArticleAction {...props.post} />}
                    content={
                        <>
                            {props.post.author == username && (
                                <Card isRounded className="p-3 mb-4 d-flex justify-content-between align-items-center">
                                    <Text fontSize={5} fontWeight={600}>
                                        포스트 관리
                                    </Text>
                                    <div>
                                        <Button gap="little" onClick={handleClickEdit}>수정</Button>
                                        <Button gap="little" onClick={handleClickAnalytics}>분석</Button>
                                        <Button onClick={handleClickDelete}>삭제</Button>
                                    </div>
                                </Card>
                            )}
                            <ArticleContent html={props.post.textHtml} />
                            <TagBadges
                                items={props.post.tags.map(item => (
                                    <Link href={`/@${props.post.author}/posts/${item}`}>
                                        {item}
                                    </Link>
                                ))}
                            />
                            <ArticleThanks
                                author={props.post.author}
                                url={props.post.url}
                            />
                            <ArticleSeries
                                author={props.post.author}
                                url={props.post.url}
                                series={props.post.series}
                            />
                        </>
                    }
                    navigation={<ArticleNav text={props.post.textHtml} />}
                />
            </article>
            <ArticleComment
                author={props.post.author}
                url={props.post.url}
                totalComment={props.post.totalComment}
            />
            <Footer isDark className="">
                <div className="x-container">
                    <ArticleAuthor {...props.profile} />
                    <RelatedArticles
                        author={props.post.author}
                        name={props.profile.profile.name}
                        bio={props.profile.profile.bio}
                        url={props.post.url}
                    />
                </div>
            </Footer>
        </>
    );
}

export default PostDetail;
