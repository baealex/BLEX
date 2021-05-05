import React from 'react';
import Head from 'next/head';

import PageNav from '@components/common/PageNav';
import Profile from '@components/profile/Profile';
import SeriesCard from '@components/profile/Series/SeriesCard';
import PurpleBorder from '@components/common/PurpleBorder';

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
                profile: data,
                series: series.data.body
            }
        }
    } catch(error) {
        return {
            notFound: true
        };
    }
}

interface Props {
    page: number,
    profile: API.ProfileData,
    series: API.GetUserSeriesData,
}

export default function UserSeries(props: Props) {
    return (
        <>
            <Head>
                <title>{props.profile.profile.username} ({props.profile.profile.realname}) —  Series</title>
            </Head>

            <Profile
                active="series"
                profile={props.profile.profile}
                social={props.profile.social!}
            />
            <SeriesCard series={props.series.series}>
                <div className="container">
                    <div className="col-lg-8 mx-auto">
                        {props.series.series.length > 0 ? '' : (
                            <PurpleBorder text="아직 생성된 시리즈가 없습니다."/>
                        )}
                        <PageNav
                            page={props.page}
                            last={props.series.lastPage}
                        />
                    </div>
                </div>
            </SeriesCard>
        </>
    )
}