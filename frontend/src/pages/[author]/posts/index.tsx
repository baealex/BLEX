import type { GetServerSideProps } from 'next';
import React from 'react';

import { authorRenameCheck } from '~/modules/middleware/author';

import { Flex, Text } from '@design-system';
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
            API.getUserPosts(author, Number(page))
        ]);

        return {
            props: {
                page,
                tag: 'all',
                ...userProfile.data.body,
                ...userPosts.data.body
            }
        };
    } catch (error) {
        return await authorRenameCheck(error, {
            author,
            continuePath: '/posts'
        });
    }
};

const UserPosts: PageComponent<Props> = (props) => {
    return (
        <>
            <SEO
                title={`포스트 | ${props.profile.username}`}
                image={props.profile.image}
                description={`${props.profile.name}님이 작성한 포스트에요.`}
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
        {props.posts.length <= 0 ? (
            <div className="x-container">
                <Flex justify="center" align="center" direction="column" className="py-5">
                    <img className="w-100" src="/illustrators/notify.svg" />
                    <Text className="mt-5" fontSize={6}>
                        아직 작성된 포스트가 없습니다.
                    </Text>
                </Flex>
            </div>
        ) : (
            <div className="container">
                <UserArticles
                    allCount={props.allCount}
                    active={props.tag}
                    author={props.profile.username}
                    tags={props.tags}
                    posts={props.posts}>
                    {page}
                </UserArticles>
            </div>
        )}
    </ProfileLayout>
);

export default UserPosts;
