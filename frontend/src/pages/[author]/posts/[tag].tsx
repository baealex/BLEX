import React from 'react';
import Head from 'next/head';

import { Pagination, SEO } from '@components/shared';
import { Layout, UserArticles } from '@components/profile';

import * as API from '@modules/api';

import { GetServerSidePropsContext } from 'next';

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const {
        author = '',
        tag = '',
        page = 1,
    } = context.query;

    try {
        if(!author.includes('@')) {
            throw 'invalid author';
        }

        const userProfile = await API.getUserProfile(author as string, [
            'profile',
            'social',
            'tags'
        ]);
        
        const userPosts = await API.getUserPosts(
            author as string, 
            Number(page),
            tag as string,
        );

        return {
            props: {
                page,
                tag: tag ? tag : 'all',
                ...userProfile.data.body,
                ...userPosts.data.body
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
                <title>{props.profile.username}'s {props.tag}</title>
            </Head>
            <SEO
                title={`${props.profile.username}'s ${props.tag}`}
                image={props.profile.image}
                description={`${props.profile.realname}님이 '${props.tag}' 주제로 작성한 포스트를 만나보세요.`}
            />

            <Pagination
                page={props.page}
                last={props.lastPage}
            />
        </>
    )
}

UserPosts.pageLayout = (page: JSX.Element, props: Props) => (
    <Layout
        active="posts"
        profile={props.profile}
        social={props.social!}
    >
        <div className="container">
            <UserArticles
                allCount={props.allCount}
                active={props.tag}
                author={props.profile.username}
                tags={props.tags!}
                posts={props.posts}
            >
                {page}
            </UserArticles>
        </div>
    </Layout>
)