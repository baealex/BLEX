import Head from 'next/head';
import Link from 'next/link';
import axios from 'axios';
import React from 'react'

import ArticleContent from '../../components/article/ArticleContent'
import Comment from '../../components/comment/Comment'
import CommentAlert from '../../components/comment/CommentAlert'

import API from '../../modules/api'
import lazyLoad from '../../modules/lazy'

export async function getServerSideProps(context) {
    const { posturl } = context.query;
    const { data } = await API.getPost(posturl);
    return { props: { data } }
}

class Post extends React.Component {
    componentDidMount() {
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
                href = `https://twitter.com/intent/tweet?text=${this.props.data.title}&url=${window.location.href}`;
                size = 'width=550,height=235';
                break;
            case 'facebook':
                href = `https://facebook.com/sharer.php?u=${window.location.href}`;
                size = 'width=550,height=435';
                break;
            case 'pinterest':
                href = `https://pinterest.com/pin/create/button/?url=${window.location.href}&media=${this.props.data.image}&description=${this.props.data.description}`
                size = 'width=650,height=500';
                break;
        }
        window.open(href, `${sns}-share`, size);
    }

    render() {
        return (
            <>
                <Head>
                    <title>{`${this.props.data.title} — ${this.props.data.author}`}</title>
                </Head>
    
                <div className="container">
                    <div className="row">
                        <div className="col-lg-2">
                            <div className="sticky-top sticky-top-200 sticky-margin-top-40">
                                <div className="share">
                                    <ul className="px-3">
                                        <li className="mx-4" onClick={() => this.onClickLike()}>
                                            <i className="far fa-heart"></i>
                                            <span className="mobile-disable">{this.props.data.total_likes}</span>
                                        </li>
                                        <li className="mx-4" onClick={() => this.onClickComment()}>
                                            <i className="far fa-comment"></i>
                                            <span className="mobile-disable">{this.props.data.comments.length}</span>
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
                            <h1 className="post-headline">{this.props.data.title}</h1>
                            <p>{this.props.data.created_date}</p>
                            <ArticleContent html={this.props.data.text_html}/>
                        </div>
                        <div className="col-lg-2">

                        </div>
                    </div>
                </div>
                <div className="py-5 bg-comment">
                    <div className="container">
                        <div className="col-lg-8 mx-auto px-0">
                            {this.props.data.comments ? this.props.data.comments.map(comment => (
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