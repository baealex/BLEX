import React from 'react';
import Head from 'next/head';

import ArticleCard from '@components/article/ArticleCard';
import SEO from '@components/seo';
import PageNav from '@components/common/PageNav';
import Footer from '@components/common/Footer';

import API from '@modules/api';

export async function getServerSideProps(context) {
    const raise = require('@modules/raise');

    let { page } = context.query;
    page = page ? page : 1;
    
    try {
        const { data } = await API.getAllPosts('trendy', page);
        return { props: { data, page } }
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
                    <title>BLOG EXPRESS ME</title>
                </Head>

                <SEO
                    title={`BLOG EXPRESS ME`}
                    description={`나를 표현하는 블로그, BLEX`}
                />

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