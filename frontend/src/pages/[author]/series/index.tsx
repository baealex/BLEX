import type { GetServerSideProps } from 'next';
import React from 'react';

import { authorRenameCheck } from '~/modules/middleware/author';

import { Container, Flex, Text } from '~/components/design-system';
import {
    ProfileLayout,
    UserSeries
} from '~/components/system-design/profile';
import type { PageComponent } from '~/components';
import { SEO } from '~/components/system-design/shared';

import * as API from '~/modules/api';

import { useInfinityScroll } from '~/hooks/use-infinity-scroll';

export const getServerSideProps: GetServerSideProps = async (context) => {
    const { author = '' } = context.query as {
        [key: string]: string;
    };

    if (!author.startsWith('@')) {
        return { notFound: true };
    }

    try {
        const [userProfile, userSeries] = await Promise.all([
            API.getUserProfile(author, [
                'profile',
                'social'
            ]),
            API.getUserSeries(author, 1)
        ]);

        return {
            props: {
                author,
                ...userProfile.data.body,
                ...userSeries.data.body
            }
        };
    } catch (error) {
        return await authorRenameCheck(error, {
            author,
            continuePath: '/series'
        });
    }
};

interface Props extends API.GetUserProfileResponseData, API.GetUserSeriesResponseData {
    author: string;
}

const SeriesProfile: PageComponent<Props> = (props) => {
    const { data: series } = useInfinityScroll({
        key: [props.author, 'series'],
        callback: async (nextPage) => {
            const { data } = await API.getUserSeries(props.author, nextPage);
            return data.body.series;
        },
        initialValue: props.series,
        lastPage: props.lastPage
    });

    return (
        <>
            <SEO
                title={`시리즈 | ${props.profile.username}`}
                image={props.profile.image}
                description={`${props.profile.name}님이 작성한 시리즈에요.`}
                url={`https://blex.me/@${props.profile.username}/series`}
                type="website"
                canonicalUrl={`https://blex.me/@${props.profile.username}/series`}
                twitterCard="summary"
                twitterCreator={`@${props.profile.username}`}
                siteName="BLEX"
                structuredData={{
                    '@context': 'https://schema.org',
                    '@type': 'CollectionPage',
                    'name': `시리즈 | ${props.profile.username}`,
                    'description': `${props.profile.name}님이 작성한 시리즈에요.`,
                    'url': `https://blex.me/@${props.profile.username}/series`,
                    'author': {
                        '@type': 'Person',
                        'name': props.profile.name,
                        'alternateName': props.profile.username,
                        'image': props.profile.image,
                        'url': `https://blex.me/@${props.profile.username}`
                    }
                }}
            />
            <UserSeries series={series} />
        </>
    );
};

SeriesProfile.pageLayout = (page, props) => (
    <ProfileLayout
        active="Series"
        profile={props.profile}
        social={props.social}>
        {props.series.length <= 0 ? (
            <Container size="sm">
                <Flex justify="center" align="center" direction="column" className="py-5">
                    <img className="w-100" src="/illustrators/focus.svg" />
                    <Text className="mt-5" fontSize={6}>
                        아직 생성된 시리즈가 없습니다.
                    </Text>
                </Flex>
            </Container>
        ) : page}
    </ProfileLayout>
);

export default SeriesProfile;
