import { useEffect, useState } from 'react';
import Head from 'next/head';

import Profile from '@components/profile/Profile';
import Heatmap from '@components/profile/Heatmap';
import RecentActivity from '@components/profile/RecentActivity';
import FeatureArticle from '@components/profile/FeatureArticle';

import * as API from '@modules/api';
import Global from '@modules/global';

import { GetServerSidePropsContext } from 'next';

interface Props {
    profile: API.ProfileData
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const { author = '' } = context.query;
    
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
                profile: data
            }
        }
    } catch(error) {
        return {
            notFound: true
        };
    }
}

export default function Overview(props: Props) {
    const [ isNightMode, setIsNightMode ] = useState(Global.state.isNightMode);

    useEffect(() => {
        Global.appendUpdater('Overview', () => {
            setIsNightMode(Global.state.isNightMode);
        });

        return () => Global.popUpdater('Overview');
    }, []);

    return (
        <>
            <Head>
                <title>{props.profile.profile.username} ({props.profile.profile.realname})</title>
            </Head>

            <Profile
                active="overview"
                profile={props.profile.profile}
                social={props.profile.social!}
            />
            <div className="container mb-4">
                <div className="col-lg-8 mx-auto p-0">
                    <Heatmap
                        isNightMode={isNightMode}
                        data={props.profile.heatmap}
                    />
                    <FeatureArticle articles={props.profile.most!}/>
                    <RecentActivity data={props.profile.recent!}/>
                </div>
            </div>
        </>
    )
}
