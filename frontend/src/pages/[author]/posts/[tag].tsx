import React from 'react';
import Head from 'next/head';

import PageNav from '@components/common/PageNav';
import Profile from '@components/profile/Profile';
import PostsComponent from '@components/profile/Posts';

import * as API from '@modules/api';
import { GetServerSidePropsContext } from 'next';

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const {
        author = '',
        tag = '',
        page = 1,
    } = context.query;

    if(!author.includes('@')) {
        return {
            notFound: true
        };
    }

    try {
        const { data } = await API.getUserProfile(author as string, [
            'profile',
            'social',
            'tags'
        ]);
        
        const posts = await API.getUserPosts(
            author as string,
            Number(page),
            tag as string
        );
        return {
            props: {
                page,
                tag,
                profile: data,
                posts: posts.data.body
            }
        }
    } catch(error) {
        return {
            notFound: true
        };
    }
}

interface Props {
    page: number;
    tag: string;
    profile: API.ProfileData;
    posts: API.GetUserPostsData;
}


export default function UserTagPosts(props: Props) {
    return (
        <>
            <Head>
                <title>{props.profile.profile.username} ({props.profile.profile.realname}) —  Posts</title>
            </Head>

            <Profile
                active="posts"
                profile={props.profile.profile}
                social={props.profile.social!}
            />
            <div className="container">
                <PostsComponent
                    allCount={props.posts.allCount}
                    active={props.tag}
                    author={props.profile.profile.username}
                    tags={props.profile.tags!}
                    posts={props.posts.posts}>
                    <PageNav
                        page={props.page}
                        last={props.posts.lastPage}
                    />
                </PostsComponent>
            </div>
        </>
    )
}