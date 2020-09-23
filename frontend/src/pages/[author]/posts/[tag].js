import Head from 'next/head';
import React from 'react';

import SEO from '../../../components/seo'

import API from '../../../modules/api'
import Profile from '../../../components/profile/Profile';
import PostsComponent from '../../../components/profile/Posts';
import PageNav from '../../../components/common/PageNav';

export async function getServerSideProps(context) {
    const { author, tag } = context.query;
    const { data } = await API.getUserProfile(author, [
        'profile',
        'social',
        'tags'
    ]);

    let { page } = context.query;
    page = page ? page : 1;
    const posts = await API.getUserPosts(author, page, tag);
    return {
        props: {
            page,
            tag,
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

    componentDidUpdate(prevProps) {
        if(this.props.posts.last_page != prevProps.posts.last_page || this.props.page != prevProps.page) {
            this.setState({
                page: Number(this.props.page),
                lastPage: Number(this.props.posts.last_page)
            })
        }
    }

    render() {
        return (
            <>
                <Head>
                    <title>{this.props.profile.profile.username}'s {this.props.tag}</title>
                </Head>

                <Profile profile={this.props.profile.profile} social={this.props.profile.social}/>
                <div className="container">
                    <PostsComponent
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