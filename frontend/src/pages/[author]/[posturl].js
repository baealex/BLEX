import Head from 'next/head';
import React from 'react';

import { toast } from 'react-toastify';

import ArticleContent from '../../components/article/ArticleContent';
import ArticleSereis from '../../components/article/ArticleSeries';
import TagList from '../../components/tag/TagList';
import Comment from '../../components/comment/Comment';
import CommentEdit from '../../components/comment/CommentEdit';
import CommentForm from '../../components/comment/CommentForm';
import CommentAlert from '../../components/comment/CommentAlert';
import SEO from '../../components/seo';

import Prism from '../../modules/library/prism';
import API from '../../modules/api';
import lazyLoad from '../../modules/lazy';
import Global from '../../modules/global';
import ArticleAuthor from '../../components/article/ArticleAuthor';

export async function getServerSideProps(context) {
    const { req } = context;
    const { author, posturl } = context.query;
    const post = await API.getPost(author, posturl, req.headers.cookie);
    const profile = await API.getUserProfile(author, [
        'profile',
        'social'
    ]);
    let resultProps = {
        hasSeries: false,
        post: post.data,
        profile: profile.data
    };
    if(post.data.series) {
        let series = await API.getSeries(author, post.data.series);
        const sereisLength = series.data.posts.length;
        const activeSeries = series.data.posts.findIndex(
            item => item.title == post.data.title
        );
        resultProps['hasSeries'] = true;
        resultProps['activeSeries'] = activeSeries;
        resultProps['sereisLength'] = sereisLength;
        resultProps['series'] = series.data;
    }
    return { props: resultProps };
}

class Post extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            isLiked: props.post.is_liked === 'true' ? true : false,
            isLogin: Global.state.isLogin,
            username: Global.state.username,
            totalLikes: props.post.total_likes,
            comments: props.post.comments.map(comment => {
                let newComment = comment;
                newComment.isEdit = false;
                newComment.contentPure = '';
                newComment.is_edited = (
                    newComment.is_edited === 'true' ? true : false
                );
                return newComment;
            })
        };
        Global.appendUpdater('Post', () => this.setState({
            ...this.state,
            isLogin: Global.state.isLogin,
            username: Global.state.username
        }));
    }

    componentDidMount() {
        Prism.highlightAll();
        lazyLoad();
    }

    componentDidUpdate(prevProps) {
        if(
            prevProps.post.is_liked !== this.props.post.is_liked ||
            prevProps.post.comments !== this.props.post.comments ||
            prevProps.post.total_likes !== this.props.post.total_likes
        ) {
            this.setState({
                ...this.state,
                isLiked: this.props.post.is_liked === 'true' ? true : false,
                totalLikes: this.props.post.total_likes,
                comments: this.props.post.comments
            });
            Prism.highlightAll();
            lazyLoad();
        }
    }

    async onClickLike() {
        const { data } = await API.putPostLike('@' + this.props.post.author, this.props.post.url);
        if(typeof data == 'number') {
            this.setState({
                isLiked: !this.state.isLiked,
                totalLikes: data
            });
        }
        else if(data.includes('error')) {
            switch(data.split(':')[1]) {
                case 'NL':
                    toast('로그인이 필요합니다.');
                    break;
                case 'SU':
                    toast('자신의 글은 추천할 수 없습니다.');
                    break;
            }
        }
    }

    onClickComment() {
        window.scrollTo({
            top: window.pageYOffset + document.querySelector('.bg-comment').getBoundingClientRect().top - 15,
            behavior: 'smooth'
        });
    }

    onClickShare(sns) {
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

    async onSubmitComment(text) {
        const { data } = await API.postComment(this.props.post.url, text);
        if(data.status !== 'success') {
            toast('댓글 작성 실패!');
            return;
        }
        this.setState({
            ...this.setState,
            comments: this.state.comments.concat(data.element)
        });
    }
    
    async onCommentEdit(pk) {
        const { data } = await API.getCommentMd(pk);
        let { comments } = this.state;
        comments = comments.map(comment => (
            comment.pk == pk ? ({
                ...comment,
                isEdit: true,
                contentPure: data
            }) : comment
        ));
        this.setState({...this.state, comments});
    }

    async onCommentEditSubmit(pk, comment) {
        const { data } = await API.putComment(pk, comment);
        let { comments } = this.state;
        comments = comments.map(comment => (
            comment.pk == pk ? ({
                ...comment,
                isEdit: false,
                isEdited: true,
                text_html: data
            }) : comment
        ));
        this.setState({...this.state, comments});
    }

    async onCommentEditCancle(pk) {
        let { comments } = this.state;
        comments = comments.map(comment => (
            comment.pk == pk ? ({
                ...comment,
                isEdit: false,
            }) : comment
        ));
        this.setState({...this.state, comments});
    }

    async onCommentDelete(pk) {
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
                    url={this.props.url}
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
                            <h1 className="post-headline">{this.props.post.title}</h1>
                            <p>{this.props.post.created_date}</p>
                            <ArticleAuthor {...this.props.profile}/>
                            <ArticleContent html={this.props.post.text_html}/>
                            <TagList author={this.props.post.author} tag={this.props.post.tag.split(',')}/>
                            {this.props.hasSeries ? (
                                <ArticleSereis
                                    url={this.props.series.url}
                                    title={this.props.series.title}
                                    posts={this.props.series.posts}
                                    author={this.props.post.author}
                                    authorImage={this.props.post.author_image}
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
                            {this.state.comments.length > 0 ? this.state.comments.map((comment, idx) => (
                                comment.isEdit ? (
                                    <CommentEdit
                                        pk={comment.pk}
                                        comment={comment.contentPure}
                                        onSubmit={(pk, comment) => this.onCommentEditSubmit(pk, comment)}
                                        onCancle={(pk) => this.onCommentEditCancle(pk)}
                                    />
                                ) : (
                                    <Comment
                                        key={idx}
                                        pk={comment.pk}
                                        author={comment.author}
                                        authorImage={comment.author_image}
                                        timeSince={comment.time_since}
                                        html={comment.text_html}
                                        isEdited={comment.is_edited}
                                        isOwner={this.state.username === comment.author ? true : false}
                                        onEdit={(pk) => this.onCommentEdit(pk)}
                                        onDelete={(pk) => this.onCommentDelete(pk)}
                                    />
                                )
                            )) : <CommentAlert
                                    text={'작성된 댓글이 없습니다!'}
                                />
                            }
                            {this.state.isLogin ? (
                                <CommentForm onSubmit={this.onSubmitComment.bind(this)}/>
                            ) : (
                                <div className="noto alert alert-warning s-shadow">댓글을 작성하기 위해 로그인이 필요합니다.</div>
                            )}
                        </div>
                    </div>
                </div>
            </>
        )
    }
}

export default Post