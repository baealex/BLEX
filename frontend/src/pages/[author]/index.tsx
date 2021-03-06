import { useEffect, useState } from 'react';
import Head from 'next/head';

import Profile from '@components/profile/Profile';
import Heatmap from '@components/profile/Heatmap';
import RecentActivity from '@components/profile/RecentActivity';
import FeatureArticle from '@components/profile/FeatureArticle';

import * as API from '@modules/api';
import Global from '@modules/global';

import { GetServerSidePropsContext } from 'next';

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const {
        author = ''
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
            'heatmap',
            'most',
            'recent'
        ]);
        return {
            props: {
                ...data.body,
            }
        }
    } catch(error) {
        return {
            notFound: true
        };
    }
}

interface Props extends API.GetUserProfileData {};

export default function Overview(props: Props) {
    const [ isNightMode, setIsNightMode ] = useState(Global.state.theme === 'dark');

    useEffect(() => {
        const updateKey = Global.appendUpdater(() => {
            setIsNightMode(Global.state.theme === 'dark');
        });

        return () => Global.popUpdater(updateKey);
    }, []);

    return (
        <>
            <Head>
                <title>{props.profile.username} ({props.profile.realname})</title>
            </Head>

            <Profile
                active="overview"
                profile={props.profile}
                social={props.social!}
            />
            <div className="container mb-4">
                <div className="col-lg-8 mx-auto p-0">
                    <FeatureArticle articles={props.most!}/>
                    <Heatmap
                        isNightMode={isNightMode}
                        data={props.heatmap}
                    />
                    <RecentActivity data={props.recent!}/>
                </div>
            </div>
        </>
    )
}
