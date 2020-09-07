import React from 'react'
import Head from 'next/head'
import Link from 'next/link'

import ArticleCard from '../components/article/ArticleCard'

import API from '../modules/api'

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

    onNextPage() {
        let newState = this.state;
        newState.page += 1;
        this.setState(newState);
    }

    onPrevPage() {
        let newState = this.state;
        newState.page -= 1;
        this.setState(newState);
    }

    render() {
        return (
            <>
                <Head>
                    <title>BLOG EXPRESS ME</title>
                </Head>

                <div className="container">
                    <div className="row">
                        {this.props.data.items.map((item, idx) => (
                            <ArticleCard
                                key={idx}
                                image={item.image}
                                url={item.url}
                                title={item.title}
                                author={item.author}
                                authorImage={item.author_image}
                            />
                        ))}
                    </div>

                    <div className="page-nav">
                        <div className="page-button">
                            <Link href={`?page=${this.state.page - 1}`}>
                                <a onClick={() => this.onPrevPage()}>이전 페이지</a>
                            </Link>
                        </div>
                        
                        <div className="page-button">
                            <Link href={`?page=${this.state.page + 1}`}>
                                <a onClick={() => this.onNextPage()}>다음 페이지</a>
                            </Link>
                        </div>
                    </div>
                </div>

                <style jsx>{`
                    .page-nav {

                    }

                    .page-button {
                        display: inline-block;
                        padding: 16px;
                        border-radius: 8px;
                        border: 2px solid #ccc;
                    }
                `}</style>
            </>
        )
    }
}

export default Home;