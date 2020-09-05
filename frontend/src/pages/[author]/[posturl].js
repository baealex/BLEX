import Head from 'next/head';
import Link from 'next/link';
import axios from 'axios';
import React from 'react'

import ArticleContent from '../../components/article/ArticleContent'
import Comment from '../../components/comment/Comment'
import NoComment from '../../components/comment/NoComment'

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

    render() {
        console.log(this.props);
        return (
            <>
                <Head>
                    <title>{`${this.props.data.title} — ${this.props.data.author}`}</title>
                </Head>
    
                <div className="container">
                    <h1>{this.props.data.title}</h1>
                    <p>{this.props.data.author}</p>
        
                    <ArticleContent html={this.props.data.text_html}/>

                    {this.props.data.comments ? this.props.data.comments.map(comment => (
                        <Comment
                            author={comment.author}
                            authorImage={comment.author_image}
                            html={comment.text_html}
                        />
                    )) : <NoComment/>}
                </div>
            </>
        )
    }
}

export default Post