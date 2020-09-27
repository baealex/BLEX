import Link from 'next/link';
import Head from 'next/head';
import React from 'react';

import API from '../../../modules/api'

export async function getServerSideProps(context) {
    const { author, seriesurl } = context.query;
    const { data } = await API.getSeries(author, seriesurl);
    return {
        props: {
            series: data
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
                <Head>
                    <title>{this.props.series.owner} — '{this.props.series.title}' 시리즈</title>
                </Head>

                <div className="container">
                    <div className="back-image series-title-image" style={{backgroundImage: `url(https://static.blex.me/${this.props.series.image})`}}>
                        <div className="fade-mask"></div>
                    </div>
                    <div className="series-list">
                        <div className="col-lg-8 mx-auto">
                            <h2 className="serif font-weight-bold">
                                '{this.props.series.title}' 시리즈
                            </h2>
                            <Link href="/[author]" as={`/@${this.props.series.owner}`}>
                                <a className="post-series deep-dark serif font-weight-bold mb-3">
                                    Created by {this.props.series.owner}
                                </a>
                            </Link>
                            <div className="series-desc mb-4">
                                <blockquote className="noto">
                                    {this.props.series.description ? this.props.series.description : '이 시리즈에 대한 설명이 없습니다.'}
                                </blockquote>
                                <div className="author">
                                    <Link href="/[author]" as={`/@${this.props.series.owner}`}>
                                        <a>
                                            <img src={this.props.series.owner_image}/>
                                        </a>
                                    </Link>
                                </div>
                            </div>
                            {this.props.series.posts.map((post, idx) => (
                                <div className="mb-5">
                                    <h5 className="card-title serif font-weight-bold">
                                        <Link href="/[author]/[posturl]" as={`/@${this.props.series.owner}/${post.url}`}>
                                            <a className="deep-dark">{idx + 1}. {post.title}</a>
                                        </Link>
                                    </h5>
                                    <p>
                                        <Link href="/[author]/[posturl]" as={`/@${this.props.series.owner}/${post.url}`}>
                                            <a className="shallow-dark noto">{post.description}</a>
                                        </Link>
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </>
        )
    }
}

export default Series