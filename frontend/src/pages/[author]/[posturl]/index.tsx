import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Router from 'next/router';

import ArticleCard from '@components/article/ArticleCard';
import ArticleAuthor from '@components/article/ArticleAuthor';
import ArticleContent from '@components/article/ArticleContent';
import ArticleSereis from '@components/article/ArticleSeries';
import { Comment } from '@components/comment';
import TagList from '@components/tag/TagList';
import Toggle from '@components/atoms/toggle';
import Footer from '@components/common/Footer';
import SEO from '@components/seo';

import { toast } from 'react-toastify';

import Prism from '@modules/library/prism';
import * as API from '@modules/api';
import {
    lazyLoadResource,
    lazyIntersection
} from '@modules/lazy';
import Global from '@modules/global';

import { GetServerSidePropsContext } from 'next';

import { ArticleAuthorProps } from '@components/article/ArticleAuthor';
import { FeaturePostsData } from '@modules/api';

interface Props {
    profile: ArticleAuthorProps,
    post: {
        url: string;
        title: string;
        image: string;
        author: string;
        authorImage: string;
        isLiked: boolean;
        totalLikes: number;
        totalComment: number;
        description: string;
        createdDate: string;
        updatedDate: string;
        tag: string;
        textHtml: string;
    },
    series: {
        url: string;
        title: string;
        description: string;
        posts: SeriesPosts[];
    },
    hasSeries: boolean;
    activeSeries: number;
    sereisLength: number;
}

interface State {
    isLogin: boolean;
    isLiked: boolean;
    username: string;
    totalLikes: number;
    comments: Comment[];
    commentForm: string;
    selectedTag?: string;
    headerNav: string[][];
    headerNow: string;
    isOpenSideIndex: boolean;
    featurePosts?: FeaturePostsData;
}

interface Comment {
    pk: number;
    author: string;
    authorImage: string;
    isEdit: boolean;
    isEdited: boolean;
    timeSince: string;
    textHtml: string;
    textMarkdown: string;
    totalLikes: number;
    isLiked: boolean;
}

interface SeriesPosts {
    url: string;
    title: string;
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const { cookies } = context.req;
    Global.configInject(cookies);

    const { author = '', posturl = '' } = context.query;
    
    if(!author.includes('@') || !posturl) {
        return {
            notFound: true
        };
    }

    const { cookie } = context.req.headers;

    try {
        const post = await API.getPost(author as string, posturl as string, 'view', cookie);

        const { referer } = context.req.headers;
        if (referer) {
            API.postAnalytics(author as string, posturl as string, {
                referer
            });
        }

        const profile = await API.getUserProfile(author as string, [
            'profile',
            'social'
        ]);
        
        if (post.data.series) {
            let series = await API.getSeries(author as string, post.data.series);
            const sereisLength = series.data.posts.length;
            const activeSeries = series.data.posts.findIndex(
                (item: SeriesPosts) => item.title == post.data.title
            );
            return { props: {
                hasSeries: true,
                post: post.data,
                profile: profile.data,
                activeSeries,
                sereisLength,
                series: series.data
            }}
        }
        return { props: {
            hasSeries: false,
            post: post.data,
            profile: profile.data
        }};
    } catch(error) {
        return {
            notFound: true
        };
    }
}

class PostDetail extends React.Component<Props, State> {
    state: State;

    constructor(props: Props) {
        super(props);
        this.state = {
            isLiked: props.post.isLiked,
            isLogin: Global.state.isLogin,
            username: Global.state.username,
            totalLikes: props.post.totalLikes,
            isOpenSideIndex: false,
            commentForm: '',
            headerNav: [],
            headerNow: '',
            comments: []
        };
        Global.appendUpdater('PostDetail', () => this.setState({
            isLogin: Global.state.isLogin,
            username: Global.state.username
        }));
    }

    componentDidMount() {
        Prism.highlightAll();
        lazyLoadResource();
        lazyIntersection('.bg-comment', async () => {
            await this.getComments();
        });
        lazyIntersection('.page-footer', async () => {
            await this.getFeatureArticle();
        });

        this.onViewUp();
        this.makeHeaderNav();
    }

    componentDidUpdate(prevProps: Props, prevState: State) {
        let needSyntaxUpdate = false;

        if (
            prevProps.post.url !== this.props.post.url ||
            prevProps.post.author !== this.props.post.author ||
            prevProps.post.isLiked !== this.props.post.isLiked ||
            prevProps.post.totalLikes !== this.props.post.totalLikes
        ) {
            this.setState({
                isLiked: this.props.post.isLiked,
                totalLikes: this.props.post.totalLikes,
                comments: []
            });
            needSyntaxUpdate = true;

            lazyIntersection('.bg-comment', async () => {
                await this.getComments();
            });
            lazyIntersection('.page-footer', async () => {
                await this.getFeatureArticle();
            });

            this.onViewUp();
            this.makeHeaderNav();
        }

        if(prevState.comments !== this.state.comments) {
            needSyntaxUpdate = true;
        }

        if(needSyntaxUpdate) {
            Prism.highlightAll();
            lazyLoadResource();
        }
    }

    makeHeaderNav() {
        const headersTags = document.querySelectorAll('.article h1, .article h2, .article h3, .article h4, .article h5, .article h6');
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

    async getComments() {
        if(this.props.post.totalComment > 0) {

        }
    }

    async getFeatureArticle() {
        const { author, url } = this.props.post;
        const { data } = await API.getFeaturePosts(author, url);
        this.setState({
            featurePosts: data
        });
    }

    async onClickLike() {
        const { author, url } = this.props.post;
        const { data } = await API.putPost('@' + author, url, 'like');
        if(typeof data == 'number') {
            this.setState({
                isLiked: !this.state.isLiked,
                totalLikes: data
            });
        }
        else if(data.includes('error')) {
            switch(data.split(':')[1]) {
                case 'NL':
                    toast('😅 로그인이 필요합니다.', {
                        onClick:() => {
                            Global.onOpenModal('isLoginModalOpen');
                        }
                    });
                    break;
                case 'SU':
                    toast('😅 자신의 글은 추천할 수 없습니다.');
                    break;
            }
        }
    }

    onClickComment() {
        window.scrollTo({
            top: window.pageYOffset + document.querySelector('.bg-comment')!.getBoundingClientRect().top - 15,
            behavior: 'smooth'
        });
    }

    onClickShare(sns: 'twitter' | 'facebook' | 'pinterest') {
        let href = '';
        let size = '';
        switch(sns) {
            case 'twitter':
                href = `https://twitter.com/intent/tweet?text=${this.props.post.title}&url=${window.location.href}`;
                size = 'width=550,height=235';
                break;
            case 'facebook':
                href = `https://facebook.com/sharer.php?u=${window.location.href}`;
                size = 'width=550,height=435';
                break;
            case 'pinterest':
                href = `https://pinterest.com/pin/create/button/?url=${window.location.href}&media=${this.props.post.image}&description=${this.props.post.description}`
                size = 'width=650,height=500';
                break;
        }
        window.open(href, `${sns}-share`, size);
    }

    onViewUp() {
        const { author, url } = this.props.post;
        API.postAnalytics('@' + author, url, {
            viewonly: Math.random()
        });
    }

    onEdit() {
        const { author, url } = this.props.post;
        Router.push(`/@${author}/${url}/edit`);
    }

    async onDelete() {
        if(confirm('😮 정말 이 포스트를 삭제할까요?')) {
            const { author, url } = this.props.post;
            const { data } = await API.deletePost('@' + author, url);
            if(data == 'DONE') {
                toast('😀 포스트가 삭제되었습니다.');
            }   
        }
    }

    render() {
        const {
            isOpenSideIndex
        } = this.state;

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
                    image={this.props.post.image}
                    isArticle={true}
                />
                <div className="container">
                    <div className="row">
                        <div className="col-lg-2">
                            <div className="sticky-top sticky-top-200 sticky-margin-top-40">
                                <div className="share">
                                    <ul className="px-3">
                                        <li className="mx-3 mx-lg-4" onClick={() => this.onClickLike()}>
                                            <i className={`${this.state.isLiked ? 'fas' : 'far'} fa-heart`}></i>
                                            <span>{this.state.totalLikes}</span>
                                        </li>
                                        <li className="mx-3 mx-lg-4" onClick={() => this.onClickComment()}>
                                            <i className="far fa-comment"></i>
                                            <span>{this.props.post.totalComment}</span>
                                        </li>
                                        <li className="mx-3 mx-lg-4" onClick={() => this.onClickShare('twitter')}>
                                            <i className="fab fa-twitter"></i>
                                        </li>
                                        <li className="mx-3 mx-lg-4" onClick={() => this.onClickShare('facebook')}>
                                            <i className="fab fa-facebook"></i>
                                        </li>
                                        <li className="mx-3 mx-lg-4" onClick={() => this.onClickShare('pinterest')}>
                                            <i className="fab fa-pinterest"></i>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-8">
                            <h1 className="post-headline">
                                {this.props.hasSeries ? (
                                    <span className="post-series">'{this.props.series.title}' 시리즈</span>
                                ) : ''}
                                {this.props.post.title}
                            </h1>
                            <time className="post-date">{this.props.post.createdDate}{this.props.post.createdDate !== this.props.post.updatedDate ? ` (Updated: ${this.props.post.updatedDate})` : ''}</time>
                            <ArticleAuthor {...this.props.profile}/>
                            {this.props.post.author == this.state.username ? (
                                <div className="mb-3 text-right">
                                    <div className="btn btn-dark noto m-1" onClick={() => this.onEdit()}>포스트 수정</div>
                                    <div className="btn btn-dark noto m-1" onClick={() => this.onDelete()}>포스트 삭제</div>
                                </div>
                            ) : ''}
                            <div className="my-3">
                                <Toggle
                                    label="링크를 새탭에서 여세요."
                                    onClick={() => {
                                        const { isOpenNewTab } = Global.state;
                                        Global.setState({
                                            isOpenNewTab: !isOpenNewTab,
                                        });
                                    }}
                                    defaultChecked={Global.state.isOpenNewTab}
                                />
                            </div>
                            <ArticleContent html={this.props.post.textHtml}/>
                            <TagList author={this.props.post.author} tag={this.props.post.tag.split(',')}/>
                            {this.props.hasSeries ? (
                                <ArticleSereis
                                    url={this.props.series.url}
                                    title={this.props.series.title}
                                    posts={this.props.series.posts}
                                    author={this.props.post.author}
                                    authorImage={this.props.post.authorImage}
                                    description={this.props.series.description}
                                    activeSeries={this.props.activeSeries}
                                    sereisLength={this.props.sereisLength}
                                />
                            ) : <></>}
                        </div>
                        <div className="col-lg-2 mobile-disable">
                            <div className="sticky-top article-nav none-drag">
                                {this.state.headerNav.map((item, idx) => (
                                    <a className={`title-${item[0]} ${this.state.headerNow == item[1] ? 'nav-now' : ''}`} key={idx} href={`#${item[1]}`}>{item[2]}</a>
                                ))}
                            </div>
                        </div>
                        {this.state.headerNav.length > 0 && (
                            <div className="pc-disable">
                                <div className={`thread-menu ${isOpenSideIndex ? 'closed' : ''}`} onClick={() => this.setState({isOpenSideIndex: !isOpenSideIndex})}>
                                    <i className="fas fa-rocket"/>
                                </div>
                                <div className={`thread-sidebar ${isOpenSideIndex ? '' : 'closed'}`}>
                                    <ul className="none-drag">
                                        {this.state.headerNav.map((item, idx) => (
                                            <li className={`story-read ml-${item[0]}`} key={idx}>
                                                <a className={this.state.headerNow == item[1] ? 'active' : ''} href={`#${item[1]}`}>{item[2]}</a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="py-5 bg-comment">
                    <Comment
                        author={this.props.post.author}
                        url={this.props.post.url}
                    />
                </div>
                <Footer bgdark={true}>
                    <div className="container pt-5 reverse-color">
                        <p className="noto">
                            <Link href={`/@${this.props.post.author}`}>
                                <a className="font-weight-bold deep-dark">
                                    {this.props.profile.profile.realname}
                                </a>
                            </Link>님이 작성한 다른 글</p>
                        <div className="row">
                            {this.state.featurePosts?.posts.map((item, idx) => (
                                <ArticleCard key={idx} {...item}/>
                            ))}
                        </div>
                    </div>
                </Footer>
            </>
        )
    }
}

export default PostDetail;