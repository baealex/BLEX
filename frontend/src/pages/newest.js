import React from 'react';
import Head from 'next/head';

import ArticleCard from '@components/article/ArticleCard';
import PageNav from '@components/common/PageNav';
import Footer from '@components/common/Footer';

import API from '@modules/api';

export async function getServerSideProps(context) {
    const raise = require('@modules/raise');
    
    let { page } = context.query;
    page = page ? page : 1;
    
    try {
        const { data } = await API.getAllPosts('newest', page);
        return { props: { data, page } };
    } catch(error) {
        raise.auto(error.response.status, context.res);
    }
}

class Home extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            page: Number(props.page),
            lastPage: Number(props.data.lastPage),
        };
    }

    componentDidUpdate(prevProps) {
        if(this.props.data.lastPage != prevProps.data.lastPage || this.props.page != prevProps.page) {
            this.setState({
                page: Number(this.props.page),
                lastPage: Number(this.props.data.lastPage)
            });
        }
    }

    render() {
        return (
            <>
                <Head>
                    <title>최신 포스트 — BLEX</title>
                </Head>

                <div className="container">
                    <div className="row">
                        {this.props.data.posts.map((item, idx) => (
                            <ArticleCard key={idx} {...item}/>
                        ))}
                    </div>

                    <PageNav
                        page={this.state.page}
                        last={this.state.lastPage}
                    />
                </div>
                <Footer/>
            </>
        )
    }
}

export default Home;