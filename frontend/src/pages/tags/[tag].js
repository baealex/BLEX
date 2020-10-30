import Head from 'next/head';
import React from 'react';

import SEO from '../../components/seo'

import API from '../../modules/api'
import PageNav from '../../components/common/PageNav';
import ArticleCard from '../../components/article/ArticleCard';
import TopicsDesc from '../../components/tag/TagDesc';
import Title from '../../components/common/Title';

export async function getServerSideProps(context) {
    const raise = require('../../modules/raise');

    const { tag } = context.query;

    let { page } = context.query;
    page = page ? page : 1;
    
    try {
        const { data } = await API.getTag(tag, page);
        return {
            props: {
                page,
                data
            }
        }
    } catch(error) {
        raise.auto(error.response.status, context.res);
    }
}

class Tag extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            page: Number(props.page),
            lastPage: Number(props.data.last_page)
        };
    }
    
    componentDidUpdate(prevProps) {
        if(this.props.data.last_page != prevProps.data.last_page || this.props.page != prevProps.page) {
            this.setState({
                page: Number(this.props.page),
                lastPage: Number(this.props.data.last_page)
            })
        }
    }

    render() {
        return (
            <>
                <Head>
                    <title>{this.props.data.tag} —  BLEX</title>
                </Head>

                <div className="container">
                    <Title text={this.props.data.tag}/>
                    {this.props.data.desc.url ? (
                        <TopicsDesc {...this.props.data.desc}/>
                    ) : ''}
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

export default Tag;