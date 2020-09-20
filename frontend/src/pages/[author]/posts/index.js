import Head from 'next/head';
import Link from 'next/link';
import React from 'react';

import SEO from '../../../components/seo'

import API from '../../../modules/api'
import Profile from '../../../components/profile/Profile';
import PostsComponent from '../../../components/profile/Posts';

export async function getServerSideProps(context) {
    const { author } = context.query;
    const { data } = await API.getUserProfile(author.replace('@', ''), [
        'profile',
        'social',
        'topic'
    ]);

    let { page } = context.query;
    page = page ? page : 1;
    const posts = await API.getUserPosts(author.replace('@', ''), page);
    return {
        props: {
            profile: data,
            posts: posts.data
        }
    }
}

class Posts extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        console.log(this.props)
        return (
            <>
                <Profile profile={this.props.profile.profile} social={this.props.social}/>
                <div className="container">
                    <PostsComponent topic={this.props.profile.topic}/>
                </div>
            </>
        )
    }
}

export default Posts