import Head from 'next/head';
import React from 'react';

import SEO from '../../../components/seo'

import API from '../../../modules/api'
import Profile from '../../../components/profile/Profile';
import SeriesComponent from '../../../components/profile/Series';
import PageNav from '../../../components/common/PageNav';
import PurpleBorder from '../../../components/common/PurpleBorder';

export async function getServerSideProps(context) {
    const { author } = context.query;
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
}

class Series extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            page: Number(props.page),
            lastPage: Number(props.series.last_page)
        };
    }

    componentDidUpdate(prevProps) {
        if(this.props.series.last_page != prevProps.series.last_page || this.props.page != prevProps.page) {
            this.setState({
                page: Number(this.props.page),
                lastPage: Number(this.props.series.last_page)
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
                <SeriesComponent series={this.props.series.series}>
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
                </SeriesComponent>
            </>
        )
    }
}

export default Series