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
import type { PageComponent } from '@components';
import { Text } from '@design-system';

import * as API from '@modules/api';

export const getServerSideProps: GetServerSideProps = async (context) => {
    const {
        author = '',
        page = 1
    } = context.query;

    try {
        if (!author.includes('@')) {
            throw 'invalid author';
        }

        const userProfile = await API.getUserProfile(author as string, [
            'profile',
            'social'
        ]);

        const userSeries = await API.getUserSeries(
            author as string,
            Number(page)
        );

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
    page: number,
}

const SeriesProfile: PageComponent<Props> = (props) => {
    return (
        <>
            <SEO
                title={`${props.profile.username} (${props.profile.realname}) — Series`}
                image={props.profile.image}
                description={`${props.profile.realname}님이 생성한 모든 시리즈를 만나보세요.`}
            />
            <UserSeries series={props.series}>
                <div className="container">
                    <div className="col-lg-8 mx-auto">
                        <Pagination
                            page={props.page}
                            last={props.lastPage}
                        />
                    </div>
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
            <div className="container">
                <div className="col-lg-8 mx-auto p-0 my-4">
                    <div className="d-flex justify-content-center align-items-center flex-column py-5">
                        <img className="w-100" src="/illustrators/focus.svg" />
                        <Text className="mt-5" fontSize={6}>
                            아직 생성된 시리즈가 없습니다.
                        </Text>
                    </div>
                </div>
            </div>
        ) : page}
    </ProfileLayout>
);

export default SeriesProfile;
