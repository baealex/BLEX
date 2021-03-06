import React from 'react';
import Head from 'next/head';

import { Alert } from '@components/atoms';
import { Pagination } from '@components/shared';
import Profile from '@components/profile/Profile';
import SeriesCard from '@components/profile/Series/SeriesCard';

import * as API from '@modules/api'
import { GetServerSidePropsContext } from 'next';

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const {
        author = '',
        page = 1,
    } = context.query;

    if(!author.includes('@')) {
        return {
            notFound: true
        };
    }

    try {
        const { data } = await API.getUserProfile(author as string, [
            'profile',
            'social',
        ]);
        const series = await API.getUserSeries(author as string, Number(page));
        return {
            props: {
                page,
                ...data.body,
                ...series.data.body,
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

export default function UserSeries(props: Props) {
    return (
        <>
            <Head>
                <title>{props.profile.username} ({props.profile.realname}) —  Series</title>
            </Head>

            <Profile
                active="series"
                profile={props.profile}
                social={props.social!}
            />
            <SeriesCard series={props.series}>
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
            </SeriesCard>
        </>
    )
}