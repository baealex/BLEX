import { useEffect, useState } from 'react';
import Head from 'next/head';
import { GetServerSidePropsContext } from 'next';

import { Heatmap, SEO } from '@components/shared';
import {
    Featured,
    Layout,
    RecentActivity,
} from '@components/profile';

import * as API from '@modules/api';

import { configStore } from 'stores/config';

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
    const [ isNightMode, setIsNightMode ] = useState(configStore.state.theme === 'dark');

    useEffect(() => {
        const updateKey = configStore.subscribe((state) => {
            setIsNightMode(state.theme === 'dark');
        });

        return () => configStore.unsubscribe(updateKey);
    }, []);

    return (
        <>
            <Head>
                <title>{props.profile.username} ({props.profile.realname})</title>
            </Head>
            <SEO
                title={`${props.profile.username} (${props.profile.realname})`}
                image={props.profile.image}
                description={props.profile.bio}
            />

            <div className="container mb-4">
                <div className="col-lg-8 mx-auto p-0">
                    <Featured articles={props.most!}/>
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

Overview.pageLayout = (page: JSX.Element, props: Props) => (
    <Layout
        active="overview"
        profile={props.profile}
        social={props.social!}
    >
        {page}
    </Layout>
)