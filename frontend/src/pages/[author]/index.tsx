import React from 'react';
import Head from 'next/head';

import Profile from '@components/profile/Profile';
import Heatmap from '@components/profile/Heatmap';
import HeatmapDark from '@components/profile/HeatmapDark';
import RecentActivity from '@components/profile/RecentActivity';
import FeatureArticle from '@components/profile/FeatureArticle';

import * as API from '@modules/api';
import Global from '@modules/global';

import { GetServerSidePropsContext } from 'next';

import { ProfileData } from '@modules/api';

interface Props {
    profile: ProfileData
}

interface State {
    isNightMode: boolean;
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

class Overview extends React.Component<Props, State> {
    state: State;

    constructor(props: Props) {
        super(props);
        this.state = {
            isNightMode: Global.state.isNightMode
        };
        Global.appendUpdater('Overview', () => {
            this.setState({
                isNightMode: Global.state.isNightMode
            });
        });
    }

    render() {
        let heatmap = this.state.isNightMode ? (
            <HeatmapDark data={this.props.profile.heatmap}/>
        ) : (
            <Heatmap data={this.props.profile.heatmap}/>
        );

        return (
            <>
                <Head>
                    <title>{this.props.profile.profile.username} ({this.props.profile.profile.realname})</title>
                </Head>

                <Profile active="overview" profile={this.props.profile.profile} social={this.props.profile.social!}/>
                <div className="container mb-4">
                    <div className="col-lg-8 mx-auto p-0">
                        {heatmap}
                        <FeatureArticle articles={this.props.profile.most!}/>
                        <RecentActivity data={this.props.profile.recent!}/>
                    </div>
                </div>
            </>
        )
    }
}

export default Overview;