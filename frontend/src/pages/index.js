import React from 'react'
import Head from 'next/head'

import ArticleCard from '../components/article/ArticleCard'

import API from '../modules/api'
import PageNav from '../components/common/PageNav'

export async function getServerSideProps(context) {
    let { page } = context.query;
    page = page ? page : 1;
    const { data } = await API.getAllPosts('trendy', page);
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

    componentDidUpdate(prevProps) {
        if(this.props.data.last_page != prevProps.data.last_page || this.props.page != prevProps.page) {
            this.setState({
                page: Number(this.props.page),
                lastPage: Number(this.props.data.last_page)
            });
        }
    }

    render() {
        return (
            <>
                <Head>
                    <title>BLOG EXPRESS ME</title>
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
            </>
        )
    }
}

export default Home;