import React from 'react'
import Head from 'next/head'

import ArticleCard from '../components/article/ArticleCard'

import API from '../modules/api'
import PageNav from '../components/common/PageNav'

export async function getServerSideProps(context) {
    let { page } = context.query;
    page = page ? page : 1;
    const { data } = await API.getAllPosts('newest', page);
    return { props: { data, page } }
}

class Home extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            page: Number(props.page),
            lastPage: Number(props.data.last_page),
        };
    }

    render() {
        return (
            <>
                <Head>
                    <title>최신 포스트 — BLEX</title>
                </Head>

                <div className="container">
                    <div className="row">
                        {this.props.data.items.map((item, idx) => (
                            <ArticleCard key={idx} {...item}/>
                        ))}
                    </div>

                    <PageNav
                        page={this.state.page}
                        last={this.state.lastPage}
                        setPage={(page) => this.setState({...this.state, page: page })}
                    />
                </div>
            </>
        )
    }
}

export default Home;