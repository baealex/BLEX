import type { GetServerSideProps } from 'next';
import React from 'react';

import {
    Pagination,
    SEO
} from '@system-design/shared';
import {
    ProfileLayout,
    UserArticles
} from '@system-design/profile';
import type { PageComponent } from '~/components';

import * as API from '~/modules/api';

export const getServerSideProps: GetServerSideProps = async (context) => {
    const {
        author = '',
        tag = '',
        page = 1
    } = context.query;

    try {
        if (!author.includes('@')) {
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
            tag as string
        );

        return {
            props: {
                page,
                tag: tag ? tag : 'all',
                ...userProfile.data.body,
                ...userPosts.data.body
            }
        };
    } catch (error) {
        return { notFound: true };
    }
};

interface Props extends API.GetUserProfileResponseData, API.GetUserPostsResponseData {
    page: number;
    tag: string;
}

const UserPosts: PageComponent<Props> = (props) => {
    return (
        <>
            <SEO
                title={`${props.profile.username}'s ${props.tag}`}
                image={props.profile.image}
                description={`${props.profile.name}님이 '${props.tag}' 주제로 작성한 포스트를 만나보세요.`}
            />
            <Pagination
                page={props.page}
                last={props.lastPage}
            />
        </>
    );
};

UserPosts.pageLayout = (page, props) => (
    <ProfileLayout
        active="posts"
        profile={props.profile}
        social={props.social}>
        <div className="container">
            <UserArticles
                allCount={props.allCount}
                active={props.tag}
                author={props.profile.username}
                tags={props.tags!}
                posts={props.posts}>
                {page}
            </UserArticles>
        </div>
    </ProfileLayout>
);

export default UserPosts;
