import type { GetServerSideProps } from 'next';
import React from 'react';

import { authorRenameCheck } from '~/modules/middleware/author';

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

interface Props extends API.GetUserProfileResponseData, API.GetUserPostsResponseData {
    page: number;
    tag: string;
}

export const getServerSideProps: GetServerSideProps = async (context) => {
    const {
        author = '',
        tag = '',
        page = 1
    } = context.query as Record<string, string>;

    if (!author.startsWith('@')) {
        return { notFound: true };
    }

    try {
        const [userProfile, userPosts] = await Promise.all([
            API.getUserProfile(author, [
                'profile',
                'social',
                'tags'
            ]),
            API.getUserPosts(author, Number(page), tag)
        ]);
        return {
            props: {
                page,
                tag: tag ? tag : 'all',
                ...userProfile.data.body,
                ...userPosts.data.body
            }
        };
    } catch (error) {
        return await authorRenameCheck(error, {
            author,
            continuePath: `/posts/${encodeURI(tag)}`
        });
    }
};

const UserPosts: PageComponent<Props> = (props) => {
    return (
        <>
            <SEO
                title={`포스트 - ${props.tag} | ${props.profile.username}`}
                image={props.profile.image}
                description={`${props.profile.name}님이 '${props.tag}' 주제로 작성한 포스트에요.`}
            />
            <Pagination
                hash="profile"
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
