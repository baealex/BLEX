import React from 'react';
import Head from 'next/head';

import { Pagination } from '@components/shared';
import { Layout, UserArticles } from '@components/profile';

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
            tag as string,
        );
        return {
            props: {
                page,
                tag: tag ? tag : 'all',
                ...data.body,
                ...posts.data.body
            }
        }
    } catch(error) {
        return {
            notFound: true
        };
    }
}

interface Props extends API.GetUserProfileData, API.GetUserPostsData {
    page: number;
    tag: string;
}

export default function UserPosts(props: Props) {
    return (
        <>
            <Head>
                <title>{props.profile.username} ({props.profile.realname}) —  Posts</title>
            </Head>

            <Layout
                active="posts"
                profile={props.profile}
                social={props.social!}
            />
            <div className="container">
                <UserArticles
                    allCount={props.allCount}
                    active={props.tag}
                    author={props.profile.username}
                    tags={props.tags!}
                    posts={props.posts}>
                    <Pagination
                        page={props.page}
                        last={props.lastPage}
                    />
                </UserArticles>
            </div>
        </>
    )
}