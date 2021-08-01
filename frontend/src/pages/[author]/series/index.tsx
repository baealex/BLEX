import React from 'react';
import Head from 'next/head';

import { Alert } from '@components/atoms';
import { Pagination, SEO } from '@components/shared';
import {
    Layout,
    UserSeries,
} from '@components/profile';

import * as API from '@modules/api'
import { GetServerSidePropsContext } from 'next';

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const {
        author = '',
        page = 1,
    } = context.query;

    try {
        if(!author.includes('@')) {
            throw 'invalid author';
        }

        const userProfile = await API.getUserProfile(author as string, [
            'profile',
            'social',
        ]);

        const userSeries = await API.getUserSeries(
            author as string,
            Number(page)
        );
        
        return {
            props: {
                page,
                ...userProfile.data.body,
                ...userSeries.data.body,
            }
        }
    } catch(error) {
        return {
            notFound: true
        };
    }
}


interface Props extends API.GetUserProfileData {};

interface Props extends API.GetUserProfileData, API.GetUserSeriesData {
    page: number,
}

export default function SeriesProfile(props: Props) {
    return (
        <>
            <Head>
                <title>{props.profile.username} ({props.profile.realname}) —  Series</title>
            </Head>
            <SEO
                title={`${props.profile.username} (${props.profile.realname}) —  Series`}
                image={props.profile.image}
                description={`${props.profile.realname}님이 생성한 모든 시리즈를 만나보세요.`}
            />

            <UserSeries series={props.series}>
                <div className="container">
                    <div className="col-lg-8 mx-auto">
                        {props.series.length > 0 ? '' : (
                            <Alert className="mt-4">
                                아직 생성된 시리즈가 없습니다.
                            </Alert>
                        )}
                        <Pagination
                            page={props.page}
                            last={props.lastPage}
                        />
                    </div>
                </div>
            </UserSeries>
        </>
    )
}

SeriesProfile.pageLayout = (page: JSX.Element, props: Props) => (
    <Layout
        active="series"
        profile={props.profile}
        social={props.social!}
    >
        {page}
    </Layout>
)