import React from 'react';
import Head from 'next/head';

import PageNav from '@components/common/PageNav';
import Profile from '@components/profile/Profile';
import SeriesCard from '@components/profile/Series/SeriesCard';
import PurpleBorder from '@components/common/PurpleBorder';

import * as API from '@modules/api'

export async function getServerSideProps(context) {
    const { author } = context.query;

    if(!author.includes('@')) {
        return {
            notFound: true
        };
    }

    try {
        const { data } = await API.getUserProfile(author, [
            'profile',
            'social',
        ]);
        let { page } = context.query;
        page = page ? page : 1;
        const series = await API.getUserSeries(author, page);
        return {
            props: {
                page,
                profile: data,
                series: series.data
            }
        }
    } catch(error) {
        return {
            notFound: true
        };
    }
}

class Series extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            page: Number(props.page),
            lastPage: Number(props.series.lastPage)
        };
    }

    componentDidUpdate(prevProps) {
        if(this.props.series.lastPage != prevProps.series.lastPage || this.props.page != prevProps.page) {
            this.setState({
                page: Number(this.props.page),
                lastPage: Number(this.props.series.lastPage)
            })
        }
    }
    
    render() {
        return (
            <>
                <Head>
                    <title>{this.props.profile.profile.username} ({this.props.profile.profile.realname}) —  Series</title>
                </Head>

                <Profile active="series" profile={this.props.profile.profile} social={this.props.profile.social}/>
                <SeriesCard series={this.props.series.series}>
                    <div className="container">
                        <div className="col-lg-8 mx-auto">
                            {this.props.series.series.length > 0 ? '' : (
                                <PurpleBorder text="아직 생성된 시리즈가 없습니다."/>
                            )}
                            <PageNav
                                page={this.state.page}
                                last={this.state.lastPage}
                            />
                        </div>
                    </div>
                </SeriesCard>
            </>
        )
    }
}

export default Series