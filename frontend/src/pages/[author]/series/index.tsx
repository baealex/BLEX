import React, { useState } from 'react';
import type { GetServerSideProps } from 'next';

import { authorRenameCheck } from '~/modules/middleware/author';

import { Flex, Text } from '@design-system';
import {
    ProfileLayout,
    UserSeries
} from '@system-design/profile';
import type { PageComponent } from '~/components';
import { SEO } from '@system-design/shared';

import * as API from '~/modules/api';

import { useInfinityScroll } from '~/hooks/use-infinity-scroll';
import { useMemoryStore } from '~/hooks/use-memory-store';

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
    const memoryStore = useMemoryStore([props.author, 'series'], {
        page: 1,
        series: props.series
    });

    const [page, setPage] = useState(memoryStore.page);
    const [series, setSeries] = useState(memoryStore.series);

    useInfinityScroll(async () => {
        const { data } = await API.getUserSeries(
            props.author,
            page + 1
        );

        if (data.status === 'DONE') {
            setPage((prevPage) => {
                memoryStore.page = prevPage + 1;
                return memoryStore.page;
            });
            setSeries((prevSeries) => {
                memoryStore.series = [...prevSeries, ...data.body.series];
                return memoryStore.series;
            });
        }
    }, { enabled: page < props.lastPage });

    return (
        <>
            <SEO
                title={`시리즈 | ${props.profile.username}`}
                image={props.profile.image}
                description={`${props.profile.name}님이 작성한 시리즈에요.`}
            />
            <UserSeries series={series} />
            <style jsx>{`
                :global(footer) {
                    margin-top: 0 !important;

                    :global(div) {
                        border-top: none !important;
                    }
                }
            `}</style>
        </>
    );
};

SeriesProfile.pageLayout = (page, props) => (
    <ProfileLayout
        active="series"
        profile={props.profile}
        social={props.social}>
        {props.series.length <= 0 ? (
            <div className="x-container">
                <Flex justify="center" align="center" direction="column" className="py-5">
                    <img className="w-100" src="/illustrators/focus.svg" />
                    <Text className="mt-5" fontSize={6}>
                        아직 생성된 시리즈가 없습니다.
                    </Text>
                </Flex>
            </div>
        ) : page}
    </ProfileLayout>
);

export default SeriesProfile;
