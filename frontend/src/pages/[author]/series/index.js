import Head from 'next/head';
import Link from 'next/link';
import React from 'react';

import SEO from '../../../components/seo'

import API from '../../../modules/api'
import Social from '../../../components/profile/Social';
import Profile from '../../../components/profile/Profile';
import Navigation from '../../../components/profile/Navigation';

export async function getServerSideProps(context) {
    const { author } = context.query;
    const { data } = await API.getUserProfile(author.replace('@', ''), [
        'profile',
        'social',
    ]);
    return {
        props: {
            profile: data
        }
    }
}

class Series extends React.Component {
    constructor(props) {
        super(props);

    }

    render() {
        return (
            <>
                <Profile {...this.props.profile} {...this.props.social}/>
                <Navigation username={this.props.profile.profile.username}/>
                <div className="container">

                </div>
            </>
        )
    }
}

export default Series