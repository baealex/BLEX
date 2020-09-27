import Head from 'next/head';
import React from 'react';

import SEO from '../../../components/seo'

import API from '../../../modules/api'
import Profile from '../../../components/profile/Profile';
import Navigation from '../../../components/profile/Navigation';

export async function getServerSideProps(context) {
    const { author } = context.query;
    const { data } = await API.getUserProfile(author, [
        'profile',
        'social'
    ]);
    return {
        props: {
            profile: data
        }
    }
}

class About extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <>
                <Head>
                    <title>{this.props.profile.profile.username} ({this.props.profile.profile.realname}) —  About</title>
                </Head>

                <Profile active="about" profile={this.props.profile.profile} social={this.props.profile.social}/>
                <div className="container">
                    
                </div>
            </>
        )
    }
}

export default About