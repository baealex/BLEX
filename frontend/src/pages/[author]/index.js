import React from 'react';

import SEO from '../../components/seo';

import API from '../../modules/api';
import Profile from '../../components/profile/Profile';
import Navigation from '../../components/profile/Navigation';
import Heatmap from '../../components/profile/Heatmap';
import ViewCounter from '../../components/profile/ViewCounter';
import RecentActivity from '../../components/profile/RecentActivity';

export async function getServerSideProps(context) {
    const { author } = context.query;
    const { data } = await API.getUserProfile(author.replace('@', ''), [
        'profile',
        'social',
        'heatmap',
        'view',
        'most',
        'recent'
    ]);
    return {
        props: {
            profile: data
        }
    }
}

class Overview extends React.Component {
    constructor(props) {
        super(props);

    }

    render() {
        console.log(this.props)
        return (
            <>
                <Profile {...this.props.profile} {...this.props.social}/>
                <Navigation username={this.props.profile.profile.username}/>
                <div class="container">
                    <div class="col-lg-8 mx-auto p-0">
                        <ViewCounter {...this.props.profile.view}/>
                        <Heatmap data={this.props.profile.heatmap}/>
                        <RecentActivity data={this.props.profile.recent}/>
                    </div>
                </div>
            </>
        )
    }
}

export default Overview