import React from 'react'
import Head from 'next/head'

import TagItem from '../../components/tag/TagItem'

import API from '../../modules/api'
import PageNav from '../../components/common/PageNav'

export async function getServerSideProps(context) {
    let { page } = context.query;
    page = page ? page : 1;
    const { data } = await API.getAllTags(page);
    return { props: { data, page } }
}

class Tags extends React.Component {
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
                    <title>태그 클라우드 — BLEX</title>
                </Head>

                <div className="container">
                    <div className="row">
                        {this.props.data.tags.map((item, idx) => (
                            <TagItem key={idx} {...item}/>
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

export default Tags;