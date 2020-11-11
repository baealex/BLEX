import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Router from 'next/router';

import ArticleCard from '@components/article/ArticleCard';
import ArticleAuthor from '@components/article/ArticleAuthor';
import ArticleContent from '@components/article/ArticleContent';
import ArticleSereis from '@components/article/ArticleSeries';
import TagList from '@components/tag/TagList';
import Comment from '@components/comment/Comment';
import CommentEdit from '@components/comment/CommentEdit';
import CommentForm from '@components/comment/CommentForm';
import CommentAlert from '@components/comment/CommentAlert';
import Footer from '@components/common/Footer';
import SEO from '@components/seo';

import { toast } from 'react-toastify';

import Prism from '@modules/library/prism';
import API from '@modules/api';
import lazyLoad from '@modules/lazy';
import Global from '@modules/global';
import blexer from '@modules/blexer';

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
        description: string;
        createdDate: string;
        tag: string;
        textHtml: string;
        comments: Comment[];
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
    selectedTag?: string;
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
}

interface SeriesPosts {
    url: string;
    title: string;
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const raise = require('@modules/raise');

    const { req, res } = context;
    const { author = '', posturl = '' } = context.query;

    if(!author.includes('@') || !posturl) {
        raise.Http404(res);
    }

    const cookie = req.headers['cookie'];

    try {
        const post = await API.getPost(author as string, posturl as string, 'view', cookie);

        const referer = req.headers['referer'];
        if(referer) {
            API.postAnalytics(author as string, posturl as string, {
                referer
            });
        }

        const profile = await API.getUserProfile(author as string, [
            'profile',
            'social'
        ]);
        
        if(post.data.series) {
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
        raise.auto(error.response.status, res);
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
            comments: props.post.comments.map(comment => {
                let newComment = comment;
                newComment.isEdit = false;
                newComment.textMarkdown = '';
                return newComment;
            })
        };
        Global.appendUpdater('PostDetail', () => this.setState({
            ...this.state,
            isLogin: Global.state.isLogin,
            username: Global.state.username
        }));
    }

    async componentDidMount() {
        Prism.highlightAll();
        lazyLoad();

        this.onViewUp();
        this.getFeatureArticle();
    }

    componentDidUpdate(prevProps: Props, prevState: State) {
        let needSyntaxUpdate = false;

        if(
            prevProps.post.isLiked !== this.props.post.isLiked ||
            prevProps.post.comments !== this.props.post.comments ||
            prevProps.post.totalLikes !== this.props.post.totalLikes
        ) {
            this.setState({
                ...this.state,
                isLiked: this.props.post.isLiked,
                totalLikes: this.props.post.totalLikes,
                comments: this.props.post.comments
            });
            needSyntaxUpdate = true;
            this.onViewUp();
            this.getFeatureArticle();
        }

        if(prevState.comments !== this.state.comments) {
            needSyntaxUpdate = true;
        }

        if(needSyntaxUpdate) {
            Prism.highlightAll();
            lazyLoad();
        }
    }

    async getFeatureArticle() {
        {
            const { data } = await API.getFeaturePosts(this.props.post.author, this.props.post.url);
            this.setState({
                ...this.state,
                featurePosts: data
            });
        }
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
                    toast('😅 로그인이 필요합니다.');
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

    async onSubmitComment(content: string) {
        const commentMarkup = blexer(content);
        const { data } = await API.postComment(this.props.post.url, content, commentMarkup);
        if(data.status !== 'success') {
            toast('😅 댓글 작성중 오류가 발생했습니다!');
            return;
        }
        this.setState({
            ...this.setState,
            comments: this.state.comments.concat(data.element)
        });
        lazyLoad();
    }
    
    async onCommentEdit(pk: number) {
        const { data } = await API.getCommentMd(pk);
        let { comments } = this.state;
        comments = comments.map(comment => (
            comment.pk == pk ? ({
                ...comment,
                isEdit: true,
                textMarkdown: data
            }) : comment
        ));
        this.setState({...this.state, comments});
    }

    async onCommentEditSubmit(pk: number, content: string) {
        const contentMarkup = blexer(content);
        const { data } = await API.putComment(pk, content, contentMarkup);
        let { comments } = this.state;
        if(data == 'DONE') {
            comments = comments.map(comment => (
                comment.pk == pk ? ({
                    ...comment,
                    isEdit: false,
                    textHtml: contentMarkup,
                    isEdited: true
                }) : comment
            ));
            this.setState({...this.state, comments});
            lazyLoad();
            
            toast('😀 댓글이 수정되었습니다.');
        }
    }

    async onCommentEditCancle(pk: number) {
        let { comments } = this.state;
        comments = comments.map(comment => (
            comment.pk == pk ? ({
                ...comment,
                isEdit: false,
            }) : comment
        ));
        this.setState({...this.state, comments});
    }

    async onCommentDelete(pk: number) {
        if(confirm('😮 정말 이 댓글을 삭제할까요?')) {
            const { data } = await API.deleteComment(pk);
            if(data == 'DONE') {
                let { comments } = this.state;
                comments = comments.filter(comment => (
                    comment.pk !== pk
                ));
                this.setState({...this.state, comments});
                toast('😀 댓글이 삭제되었습니다.');
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
                    image={this.props.post.image}
                    isArticle={true}
                />
                {this.props.post.image.includes('default') ? (
                    <></>
                ) : (
                    <picture className="post-title-image">
                        <img src={this.props.post.image}/>
                        <div className="post-image-mask mask-off">
                            <h1 className="post-headline fade-in">
                            {this.props.hasSeries ? (
                                <span className="post-series">'{this.props.series.title}' 시리즈</span>
                            ) : ''}
                                {this.props.post.title}
                            </h1>
                            <p className="post-date fade-in">{this.props.post.createdDate}</p>
                        </div>
                    </picture>
                )}
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
                                            <span>{this.props.post.comments.length}</span>
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
                            {this.props.post.image.includes('default') ? (
                                <>
                                    <h1 className="post-headline">
                                        {this.props.hasSeries ? (
                                            <span className="post-series">'{this.props.series.title}' 시리즈</span>
                                        ) : ''}
                                        {this.props.post.title}
                                    </h1>
                                    <p>{this.props.post.createdDate}</p>
                                </>
                            ) : (
                                <></>
                            )}
                            <ArticleAuthor {...this.props.profile}/>
                            {this.props.post.author == this.state.username ? (
                                <div className="mb-3">
                                    <div className="btn btn-block btn-dark noto" onClick={() => {Router.push(`/edit?id=${this.props.post.url}`)}}>포스트 수정</div>
                                </div>
                            ) : ''}
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
                    </div>
                </div>
                <div className="py-5 bg-comment">
                    <div className="container">
                        <div className="col-lg-8 mx-auto px-0">
                            {this.state.comments.length > 0 ? this.state.comments.map((comment, idx: number) => (
                                comment.isEdit ? (
                                    <CommentEdit
                                        pk={comment.pk}
                                        comment={comment.textMarkdown}
                                        onSubmit={(pk: number, content: string) => this.onCommentEditSubmit(pk, content)}
                                        onCancle={(pk: number) => this.onCommentEditCancle(pk)}
                                    />
                                ) : (
                                    <Comment
                                        key={idx}
                                        pk={comment.pk}
                                        author={comment.author}
                                        authorImage={comment.authorImage}
                                        timeSince={comment.timeSince}
                                        html={comment.textHtml}
                                        isEdited={comment.isEdited}
                                        isOwner={this.state.username === comment.author ? true : false}
                                        onEdit={(pk: number) => this.onCommentEdit(pk)}
                                        onDelete={(pk: number) => this.onCommentDelete(pk)}
                                    />
                                )
                            )) : <CommentAlert
                                    text={'작성된 댓글이 없습니다!'}
                                />
                            }
                            {this.state.isLogin ? (
                                <CommentForm onSubmit={this.onSubmitComment.bind(this)}/>
                            ) : (
                                <div className="noto alert alert-warning s-shadow c-pointer" onClick={() => Global.onOpenModal('isLoginModalOpen')}>
                                    댓글을 작성하기 위해 로그인이 필요합니다.
                                </div>
                            )}
                        </div>
                    </div>
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