import type { GetServerSideProps } from 'next';
import React from 'react';

import { authorRenameCheck } from '~/modules/middleware/author';

import { Alert, Flex, Loading } from '~/components/design-system';

import { ProfileLayout, UserArticles } from '~/components/system-design/profile';
import type { PageComponent } from '~/components';
import { SEO } from '~/components/system-design/shared';

import * as API from '~/modules/api';
import { useInfinityScroll } from '~/hooks/use-infinity-scroll';

interface Props extends API.GetUserProfileResponseData, API.GetUserPostsResponseData {
    tag: string;
    order: string;
    search: string;
}

export const getServerSideProps: GetServerSideProps = async (context) => {
    const {
        author = '',
        tag = '',
        order = '',
        search = ''
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
            API.getUserPosts(author, 1, {
                tag,
                order,
                search
            })
        ]);

        return {
            props: {
                tag,
                order,
                search,
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
    const { data: posts, isLoading } = useInfinityScroll({
        key: [props.profile.username, 'posts', props.tag, props.order, props.search],
        callback: async (nextPage) => {
            const { data } = await API.getUserPosts('@' + props.profile.username, nextPage, {
                tag: props.tag,
                order: props.order,
                search: props.search
            });
            return data.body.posts;
        },
        initialValue: props.posts,
        lastPage: props.lastPage
    });

    return (
        <>
            <SEO
                title={`포스트 | ${props.profile.username}`}
                image={props.profile.image}
                description={`${props.profile.name}님이 작성한 포스트에요.`}
                url={`https://blex.me/@${props.profile.username}/posts`}
                type="website"
                canonicalUrl={`https://blex.me/@${props.profile.username}/posts`}
                twitterCard="summary"
                twitterCreator={`@${props.profile.username}`}
                siteName="BLEX"
                structuredData={{
                    '@context': 'https://schema.org',
                    '@type': 'CollectionPage',
                    'name': `포스트 | ${props.profile.username}`,
                    'description': `${props.profile.name}님이 작성한 포스트에요.`,
                    'url': `https://blex.me/@${props.profile.username}/posts`,
                    'author': {
                        '@type': 'Person',
                        'name': props.profile.name,
                        'alternateName': props.profile.username,
                        'image': props.profile.image,
                        'url': `https://blex.me/@${props.profile.username}`
                    }
                }}
            />
            <UserArticles
                allCount={props.allCount}
                active={props.tag}
                author={props.profile.username}
                tags={props.tags}
                posts={posts}
            />
            {posts.length <= 0 && (
                <Alert>포스트가 존재하지 않습니다.</Alert>
            )}
            {isLoading && (
                <Flex justify="center" className="p-3">
                    <Loading position="inline" />
                </Flex>
            )}
        </>
    );
};

UserPosts.pageLayout = (page, props) => (
    <ProfileLayout
        active="Posts"
        profile={props.profile}
        social={props.social}>
        {page}
    </ProfileLayout>
);

export default UserPosts;
