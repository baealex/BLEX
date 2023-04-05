import React, { useState } from 'react';
import type { GetServerSideProps } from 'next';

import {
    ProfileLayout,
    UserSeries
} from '@system-design/profile';
import type { PageComponent } from '~/components';
import { SEO } from '@system-design/shared';
import { Text } from '@design-system';

import * as API from '~/modules/api';

import { useInfinityScroll } from '~/hooks/use-infinity-scroll';
import { useMemoryStore } from '~/hooks/use-memory-store';

export const getServerSideProps: GetServerSideProps = async (context) => {
    const { author = '' } = context.query;

    if (!author.includes('@')) {
        return { notFound: true };
    }

    try {
        const [userProfile, userSeries] = await Promise.all([
            API.getUserProfile(author as string, [
                'profile',
                'social'
            ]),
            API.getUserSeries(author as string, 1)
        ]);

        return {
            props: {
                author,
                ...userProfile.data.body,
                ...userSeries.data.body
            }
        };
    } catch (error) {
        return { notFound: true };
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
                title={`${props.profile.username} (${props.profile.name}) — Series`}
                image={props.profile.image}
                description={`${props.profile.name}님이 생성한 모든 시리즈를 만나보세요.`}
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
                <div className="d-flex justify-content-center align-items-center flex-column py-5">
                    <img className="w-100" src="/illustrators/focus.svg" />
                    <Text className="mt-5" fontSize={6}>
                        아직 생성된 시리즈가 없습니다.
                    </Text>
                </div>
            </div>
        ) : page}
    </ProfileLayout>
);

export default SeriesProfile;
