import React, { useEffect, useState } from 'react';
import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import Router from 'next/router';
import { useStore } from 'badland-react';

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
} from '@system-design/article-detail-page';
import {
    Footer,
    SEO
} from '@system-design/shared';
import { Button } from '@design-system';
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

export const getServerSideProps: GetServerSideProps = async ({ req, query }) => {
    const { cookies } = req;
    configStore.serverSideInject(cookies);

    const { author = '', posturl = '' } = query;
    if (!author.includes('@') || !posturl) {
        return { notFound: true };
    }

    const { cookie } = req.headers;

    try {
        try {
            API.postPostAnalytics(posturl as string, {
                user_agent: req.headers['user-agent'],
                referer: req.headers.referer ? req.headers.referer : '',
                ip: req.headers['x-real-ip'] || req.socket.remoteAddress,
                time: new Date().getTime()
            }, cookie);
        } catch (e) {
            console.error(e);
        }

        const [post, profile] = await Promise.all([
            API.getAnUserPostsView(
                author as string,
                posturl as string,
                cookie
            ),
            API.getUserProfile(author as string, [
                'profile'
            ])
        ]);

        return {
            props: {
                post: post.data.body,
                profile: profile.data.body
            }
        };
    } catch (error) {
        return { notFound: true };
    }
};

function PostDetail(props: Props) {
    const [ { username } ] = useStore(authStore);

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
                image={getPostsImage(props.post.image)}
                isArticle={true}
            />
            <article data-clarity-region={CONFIG.MICROSOFT_CLARITY ? 'article' : undefined}>
                <ArticleCover
                    series={props.post.seriesName}
                    image={props.post.image}
                    title={props.post.title}
                    isAd={props.post.isAd}
                    createdDate={props.post.createdDate}
                    updatedDate={props.post.updatedDate}
                />
                <div className="container">
                    <div className="row">
                        <div className="article-action">
                            <ArticleAction {...props.post}/>
                        </div>
                        <div className="article-content">
                            {props.post.author == username && (
                                <div className="mb-3">
                                    <Button gap="little" onClick={handleClickEdit}>포스트 수정</Button>
                                    <Button onClick={handleClickDelete}>포스트 삭제</Button>
                                </div>
                            )}
                            <ArticleAuthor {...props.profile}/>
                            <ArticleContent html={props.post.textHtml}/>
                            <TagBadges
                                items={props.post.tags.map(item => (
                                    <Link href={`/@${props.post.author}/posts/${item}`}>
                                        <a>{item}</a>
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
                        </div>
                        <div className="article-nav">
                            <ArticleNav text={props.post.textHtml} />
                        </div>
                    </div>
                    <style jsx>{`
                        .container {
                            padding: 0;
                        }

                        .row {
                            display: flex;
                            flex-direction: row;
                        }
                        
                        .article-action {
                            flex: 0 0 220px;
                            margin-bottom: 80px;
                        }

                        .article-content {
                            max-width: 100%;
                            width: 760px;
                            flex: 0 0 760px;
                            padding: 0 15px;
                        }

                        .article-nav {
                            flex: 1;
                            padding: 0 15px;
                        }

                        @media (max-width: 1120px) {
                            .row {
                                flex-direction: column;
                                align-items: center;
                            }

                            .article-content {
                                flex: 0 0 100%;
                            }

                            .article-action {
                                order: 1;
                                display: contents;
                            }

                            .article-nav {
                                max-width: 100%;
                                width: 760px;
                                order: -1;
                            }
                        }
                    `}</style>
                </div>
            </article>
            <ArticleComment
                author={props.post.author}
                url={props.post.url}
                totalComment={props.post.totalComment}
            />
            <Footer isDark>
                <RelatedArticles
                    author={props.post.author}
                    name={props.profile.profile.name}
                    bio={props.profile.profile.bio}
                    url={props.post.url}
                />
            </Footer>
        </>
    );
}

export default PostDetail;
