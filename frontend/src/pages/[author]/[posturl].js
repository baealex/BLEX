import Head from 'next/head';
import Link from 'next/link';
import axios from 'axios';
import React from 'react'

import ArticleContent from '../../components/article/ArticleContent'
import ArticleSereis from '../../components/article/ArticleSeries'
import Comment from '../../components/comment/Comment'
import CommentAlert from '../../components/comment/CommentAlert'

import API from '../../modules/api'
import lazyLoad from '../../modules/lazy'

export async function getServerSideProps(context) {
    const { posturl } = context.query;
    const post = await API.getPost(posturl);
    if(post.data.series) {
        let series = await API.getSeries(post.data.series);
        const sereisLength = series.data.posts.length;
        const activeSeries = series.data.posts.findIndex(
            item => item.title == post.data.title
        );
        return {
            props: {
                activeSeries,
                hasSeries: true,
                post: post.data,
                series: series.data,
                sereisLength
            }
        }
    }
    return {
        props: {
            hasSeries: false,
            post: post.data
        }
    }
}

class Post extends React.Component {
    componentDidMount() {
        lazyLoad();
    }

    componentDidUpdate() {
        lazyLoad();
    }

    onClickLike() {
        // TODO CSRF 처리
        alert('좋아요 ♥');
    }

    onClickComment() {
        window.scrollTo({
            top: window.pageYOffset + document.querySelector('.bg-comment').getBoundingClientRect().top - 15,
            behavior: 'smooth'
        });
    }

    onClickCommentWirte() {

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

    render() {
        return (
            <>
                <Head>
                    <title>{`${this.props.post.title} — ${this.props.post.author}`}</title>
                </Head>
    
                <div className="container">
                    <div className="row">
                        <div className="col-lg-2">
                            <div className="sticky-top sticky-top-200 sticky-margin-top-40">
                                <div className="share">
                                    <ul className="px-3">
                                        <li className="mx-4" onClick={() => this.onClickLike()}>
                                            <i className="far fa-heart"></i>
                                            <span className="mobile-disable">{this.props.post.total_likes}</span>
                                        </li>
                                        <li className="mx-4" onClick={() => this.onClickComment()}>
                                            <i className="far fa-comment"></i>
                                            <span className="mobile-disable">{this.props.post.comments.length}</span>
                                        </li>
                                        <li className="mx-4" onClick={() => this.onClickShare('twitter')}>
                                            <i className="fab fa-twitter"></i>
                                        </li>
                                        <li className="mx-4" onClick={() => this.onClickShare('facebook')}>
                                            <i className="fab fa-facebook"></i>
                                        </li>
                                        <li className="mx-4" onClick={() => this.onClickShare('pinterest')}>
                                            <i className="fab fa-pinterest"></i>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-8">
                            <h1 className="post-headline">{this.props.post.title}</h1>
                            <p>{this.props.post.created_date}</p>
                            <ArticleContent html={this.props.post.text_html}/>
                            {this.props.hasSeries ? (
                                <ArticleSereis
                                    title={this.props.series.title}
                                    posts={this.props.series.posts}
                                    author={this.props.post.author}
                                    activeSeries={this.props.activeSeries}
                                    sereisLength={this.props.sereisLength}
                                />
                            ) : <></>}
                        </div>
                        <div className="col-lg-2">

                        </div>
                    </div>
                </div>
                <div className="py-5 bg-comment">
                    <div className="container">
                        <div className="col-lg-8 mx-auto px-0">
                            {this.props.post.comments.length > 0 ? this.props.post.comments.map(comment => (
                                <Comment
                                    author={comment.author}
                                    authorImage={comment.author_image}
                                    html={comment.text_html}
                                />
                            )) : <CommentAlert
                                    text={'작성된 댓글이 없습니다!'}
                                />
                            }
                        </div>
                    </div>
                </div>
            </>
        )
    }
}

export default Post