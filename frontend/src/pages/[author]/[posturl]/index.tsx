import React from 'react';
import { snackBar } from '@modules/snack-bar';
import Head from 'next/head';
import Router from 'next/router';
import Link from 'next/link';
import { GetServerSidePropsContext } from 'next';

import {
    ArticleAction,
    ArticleAuthor,
    ArticleContent,
    ArticleCover,
    ArticleSeries,
    Related,
} from '@components/article';
import { Comment } from '@components/comment';
import { TagBadge } from '@components/tag';
import {
    Footer,
    Toggle,
    SEO,
} from '@components/integrated';

import prism from '@modules/library/prism';
import * as API from '@modules/api';
import {
    lazyLoadResource
} from '@modules/lazy';
import { getPostsImage } from '@modules/image';

import { authContext } from '@state/auth';
import { configContext } from '@state/config';

interface Props {
    profile: API.GetUserProfileData,
    post: API.GetAnUserPostsViewData,
    series: API.GetAnUserSeriesData,
    hasSeries: boolean;
    activeSeries: number;
    sereisLength: number;
}

interface State {
    isLogin: boolean;
    isLiked: boolean;
    username: string;
    totalLikes: number;
    selectedTag?: string;
    headerNav: string[][];
    headerNow: string;
    featurePosts?: API.GetFeaturePostsData;
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const { cookies } = context.req;
    configContext.serverSideInject(cookies);

    const { req } = context;
    const { author = '', posturl = '' } = context.query;
    
    if(!author.includes('@') || !posturl) {
        return {
            notFound: true
        };
    }

    const { cookie } = context.req.headers;

    try {
        const post = await API.getAnUserPostsView(
            author as string,
            posturl as string,
            cookie
        );

        try {
            API.postPostAnalytics(posturl as string, {
                user_agent: req.headers["user-agent"],
                referer: req.headers.referer ? req.headers.referer : '',
                ip: req.headers["x-real-ip"] || req.socket.remoteAddress,
                time: new Date().getTime(),
            }, cookie);
        } catch (e) {

        }

        const profile = await API.getUserProfile(author as string, [
            'profile'
        ]);
        
        if (post.data.body.series) {
            let series = await API.getAnUserSeries(
                author as string,
                post.data.body.series
            );
            const sereisLength = series.data.body.posts.length;
            const activeSeries = series.data.body.posts.findIndex(
                (item) => item.title == post.data.body.title
            );
            return { props: {
                hasSeries: true,
                post: post.data.body,
                profile: profile.data.body,
                activeSeries,
                sereisLength,
                series: series.data.body
            }}
        }
        return { props: {
            hasSeries: false,
            post: post.data.body,
            profile: profile.data.body
        }};
    } catch(error) {
        return {
            notFound: true
        };
    }
}

class PostDetail extends React.Component<Props, State> {
    private updateKey: string;

    constructor(props: Props) {
        super(props);
        this.state = {
            isLiked: props.post.isLiked,
            isLogin: authContext.state.isLogin,
            username: authContext.state.username,
            totalLikes: props.post.totalLikes,
            headerNav: [],
            headerNow: ''
        };
        this.updateKey = authContext.append(() => this.setState({
            isLogin: authContext.state.isLogin,
            username: authContext.state.username
        }));
    }

    componentWillUnmount() {
        authContext.pop(this.updateKey);
    }

    componentDidMount() {
        prism.highlightAll();
        lazyLoadResource();
        this.makeHeaderNav();
    }

    componentDidUpdate(prevProps: Props) {
        let needSyntaxUpdate = false;

        if (
            prevProps.post.url !== this.props.post.url ||
            prevProps.post.author !== this.props.post.author ||
            prevProps.post.isLiked !== this.props.post.isLiked ||
            prevProps.post.totalLikes !== this.props.post.totalLikes
        ) {
            this.setState({
                isLiked: this.props.post.isLiked,
                totalLikes: this.props.post.totalLikes
            });
            needSyntaxUpdate = true;
            this.makeHeaderNav();
        }

        if(needSyntaxUpdate) {
            prism.highlightAll();
            lazyLoadResource();
        }
    }

    makeHeaderNav() {
        const headersTags = document.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]');
        if ("IntersectionObserver" in window) {
            const headerNav: string[][] = [];
            
            let observer = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if(entry.isIntersecting) {
                        this.setState({
                            headerNow: entry.target.id
                        });
                    }
                });
            }, {
                rootMargin: '0px 0px -95%',
            });
            
            headersTags.forEach(header => {
                if(header.id) {
                    let idNumber = 0;
                    switch(header.tagName.toUpperCase()) {
                        case 'H1':
                        case 'H2':
                            idNumber = 1;
                            break;
                        case 'H3':
                        case 'H4':
                            idNumber = 2;
                            break;
                        case 'H5':
                        case 'H6':
                            idNumber = 3;
                            break;
                    }
                    headerNav.push([
                        idNumber.toString(), header.id, header.textContent ? header.textContent : '' 
                    ]);
                    observer.observe(header);
                }
            });

            this.setState({
                headerNav
            });
        }
    }

    onEdit() {
        const { author, url } = this.props.post;
        Router.push(`/@${author}/${url}/edit`);
    }

    async onDelete() {
        if(confirm('😮 정말 이 포스트를 삭제할까요?')) {
            const { author, url } = this.props.post;
            const { data } = await API.deleteAnUserPosts('@' + author, url);
            if(data.status === 'DONE') {
                snackBar('😀 포스트가 삭제되었습니다.');
            }   
        }
    }

    render() {
        return (
            <>
                <Head>
                    <title>{`${this.props.post.title} — ${this.props.post.author}`}</title>
                </Head>
                <SEO
                    title={this.props.post.title}
                    description={this.props.post.description}
                    author={this.props.post.author}
                    keywords={this.props.post.tag}
                    image={getPostsImage(this.props.post.image)}
                    isArticle={true}
                />
                <ArticleCover
                    series={this.props.series?.name!}
                    image={this.props.post.image}
                    title={this.props.post.title}
                    isAd={this.props.post.isAd}
                    createdDate={this.props.post.createdDate}
                    updatedDate={this.props.post.updatedDate}
                />
                <div className="container">
                    <div className="row">
                        <div className="col-lg-2">
                            <ArticleAction {...this.props.post}/>
                        </div>
                        <div className="col-lg-8">
                            {this.props.post.author == this.state.username && (
                                <div className="mb-3">
                                    <div className="btn btn-dark m-1" onClick={() => this.onEdit()}>포스트 수정</div>
                                    <div className="btn btn-dark m-1" onClick={() => this.onDelete()}>포스트 삭제</div>
                                </div>
                            )}
                            <ArticleAuthor {...this.props.profile}/>
                            <div className="my-3">
                                <Toggle
                                    label="링크를 새탭에서 여세요."
                                    onClick={() => {
                                        const { isOpenNewTab } = configContext.state;
                                        configContext.setState((prevState) => ({
                                            ...prevState,
                                            isOpenNewTab: !isOpenNewTab,
                                        }));
                                    }}
                                    defaultChecked={configContext.state.isOpenNewTab}
                                />
                            </div>
                            <ArticleContent html={this.props.post.textHtml}/>
                            <TagBadge items={this.props.post.tag.split(',').map(item => (
                                <Link href={`/@${this.props.post.author}/posts/${item}`}>
                                    <a>{item}</a>
                                </Link>
                            ))}/>
                            {this.props.hasSeries && (
                                <ArticleSeries
                                    {...this.props.series}
                                    activeSeries={this.props.activeSeries}
                                    sereisLength={this.props.sereisLength}
                                />
                            )}
                        </div>
                        <div className="col-lg-2 mobile-disable">
                            <div className="sticky-top sticky-top-100 article-nav none-drag">
                                {this.state.headerNav.map((item, idx) => (
                                    <a className={`title-${item[0]} ${this.state.headerNow == item[1] ? 'nav-now' : ''}`} key={idx} href={`#${item[1]}`}>{item[2]}</a>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <Comment
                    author={this.props.post.author}
                    url={this.props.post.url}
                    totalComment={this.props.post.totalComment}
                />
                <Footer bgdark>
                    <Related
                        author={this.props.post.author}
                        realname={this.props.profile.profile.realname}
                        url={this.props.post.url}
                    />
                </Footer>
            </>
        )
    }
}

export default PostDetail;