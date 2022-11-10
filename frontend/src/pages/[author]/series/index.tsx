import type { GetServerSideProps } from 'next';
import React from 'react';

import {
    Pagination,
    SEO
} from '@system-design/shared';
import {
    ProfileLayout,
    UserSeries
} from '@system-design/profile';
import type { PageComponent } from '~/components';
import { Text } from '@design-system';

import * as API from '~/modules/api';

export const getServerSideProps: GetServerSideProps = async (context) => {
    const {
        author = '',
        page = 1
    } = context.query;

    if (!author.includes('@')) {
        return { notFound: true };
    }

    try {
        const [userProfile, userSeries] = await Promise.all([
            API.getUserProfile(author as string, [
                'profile',
                'social'
            ]),
            API.getUserSeries(
                author as string,
                Number(page)
            )
        ]);

        return {
            props: {
                page,
                ...userProfile.data.body,
                ...userSeries.data.body
            }
        };
    } catch (error) {
        return { notFound: true };
    }
};

interface Props extends API.GetUserProfileResponseData, API.GetUserSeriesResponseData {
    page: number;
}

const SeriesProfile: PageComponent<Props> = (props) => {
    return (
        <>
            <SEO
                title={`${props.profile.username} (${props.profile.name}) — Series`}
                image={props.profile.image}
                description={`${props.profile.name}님이 생성한 모든 시리즈를 만나보세요.`}
            />
            <UserSeries series={props.series}>
                <div className="x-container">
                    <Pagination
                        page={props.page}
                        last={props.lastPage}
                    />
                </div>
            </UserSeries>
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
