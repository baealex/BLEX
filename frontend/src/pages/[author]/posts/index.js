import Head from 'next/head';
import React from 'react';

import SEO from '../../../components/seo'

import API from '../../../modules/api'
import Profile from '../../../components/profile/Profile';
import PostsComponent from '../../../components/profile/Posts';
import PageNav from '../../../components/common/PageNav';

export async function getServerSideProps(context) {
    const { author } = context.query;
    const { data } = await API.getUserProfile(author, [
        'profile',
        'social',
        'topic'
    ]);

    let { page } = context.query;
    page = page ? page : 1;
    const posts = await API.getUserPosts(author, page);
    return {
        props: {
            page,
            profile: data,
            posts: posts.data
        }
    }
}

class Posts extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            page: Number(props.page),
            lastPage: Number(props.posts.last_page)
        };
    }

    render() {
        return (
            <>
                <Head>
                    <title>{this.props.profile.profile.username} ({this.props.profile.profile.realname}) —  Posts</title>
                </Head>

                <Profile profile={this.props.profile.profile} social={this.props.profile.social}/>
                <div className="container">
                    <PostsComponent
                        author={this.props.profile.profile.username}
                        topic={this.props.profile.topic}
                        posts={this.props.posts.items}>
                        <PageNav
                            page={this.state.page}
                            last={this.state.lastPage}
                            setPage={(page) => this.setState({...this.state, page: page })}
                        />
                    </PostsComponent>
                </div>
            </>
        )
    }
}

export default Posts;