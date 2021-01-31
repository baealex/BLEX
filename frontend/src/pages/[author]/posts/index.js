import React from 'react';
import Head from 'next/head';

import PageNav from '@components/common/PageNav';
import Profile from '@components/profile/Profile';
import PostsComponent from '@components/profile/Posts';

import * as API from '@modules/api';

export async function getServerSideProps(context) {
    const raise = require('@modules/raise');

    const { author } = context.query;

    if(!author.includes('@')) {
        raise.Http404(context.res);
    }

    try {
        const { data } = await API.getUserProfile(author, [
            'profile',
            'social',
            'tags'
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
    } catch(error) {
        raise.auto(error.response.status, context.res);
    }
}

class Posts extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            page: Number(props.page),
            lastPage: Number(props.posts.lastPage)
        };
    }

    componentDidUpdate(prevProps) {
        if(this.props.posts.lastPage != prevProps.posts.lastPage || this.props.page != prevProps.page) {
            this.setState({
                page: Number(this.props.page),
                lastPage: Number(this.props.posts.lastPage)
            })
        }
    }

    render() {
        return (
            <>
                <Head>
                    <title>{this.props.profile.profile.username} ({this.props.profile.profile.realname}) —  Posts</title>
                </Head>

                <Profile active="posts" profile={this.props.profile.profile} social={this.props.profile.social}/>
                <div className="container">
                    <PostsComponent
                        active="all"
                        author={this.props.profile.profile.username}
                        tags={this.props.profile.tags}
                        posts={this.props.posts.items}>
                        <PageNav
                            page={this.state.page}
                            last={this.state.lastPage}
                        />
                    </PostsComponent>
                </div>
            </>
        )
    }
}

export default Posts;