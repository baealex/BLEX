import Link from 'next/link';
import Head from 'next/head';
import React from 'react';
import Router from 'next/router';

import SeriesDesc from '@components/series/SeriesDesc';

import { toast } from 'react-toastify';

import API from '@modules/api';
import Global from '@modules/global';
import Modal from '@components/common/Modal';

import { GetServerSidePropsContext } from 'next';

interface Props {
    series: {
        url: string;
        title: string;
        image: string;
        author: string;
        authorImage: string;
        description: string;
        posts: Posts[];
    }
};

interface State {
    isLogin: boolean;
    username: string;
    seriesTitle: string;
    seriesDescription: string;
    seriesPosts: Posts[];
    isSereisModalOpen: boolean;
};

interface Posts {
    url: string;
    title: string;
    description: string;
    createdDate: string;
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const raise = require('@modules/raise');

    const { author = '', seriesurl = '' } = context.query;

    if(!author.includes('@')) {
        raise.Http404(context.res);
    }

    try {
        const { data } = await API.getSeries(author as string, seriesurl as string);
        return {
            props: {
                series: data
            }
        }
    } catch(error) {
        raise.auto(error.response.status, context.res);
    }
}

class Series extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            isLogin: Global.state.isLogin,
            username: Global.state.username,
            seriesTitle: props.series.title,
            seriesDescription: props.series.description,
            seriesPosts: props.series.posts,
            isSereisModalOpen: false
        }
        Global.appendUpdater('Series', () => this.setState({
            ...this.state,
            isLogin: Global.state.isLogin,
            username: Global.state.username
        }));
    }

    componentDidUpdate(prevProps: Props) {
        if(
            prevProps.series.title !== this.props.series.title ||
            prevProps.series.description !== this.props.series.description ||
            prevProps.series.posts !== this.props.series.posts
        ) {
            this.setState({
                ...this.state,
                seriesTitle: this.props.series.title,
                seriesDescription: this.props.series.description,
                seriesPosts: this.props.series.posts
            });
        }
    }

    onOpenModal(modalName: 'isSereisModalOpen') {
        this.setState({
            [modalName]: true
        });
    }

    onCloseModal(modalName: 'isSereisModalOpen') {
        this.setState({
            [modalName]: false
        });
    }

    onInputChange(e: React.ChangeEvent<HTMLTextAreaElement> | React.ChangeEvent<HTMLInputElement>) {
        this.setState({
            ...this.state,
            seriesDescription: e.target.value
        });
    }

    async seriesUpdate() {
        const { data } = await API.putSeries(
            '@' + this.props.series.author,
            this.props.series.url,
            {
                title: this.state.seriesTitle,
                description: this.state.seriesDescription
            }
        );
        if(data !== 'FAIL') {
            if(data !== this.props.series.url) {
                Router.replace('/[author]/series/[seriesurl]', `/@${this.state.username}/series/${data}`);
            }
            this.onCloseModal('isSereisModalOpen');
            toast('😀 시리즈가 업데이트 되었습니다.');
        } else {
            toast('😯 변경중 오류가 발생했습니다.');
        }
    }

    async onPostsRemoveInSeries(url: string) {
        if(confirm('😮 이 포스트를 시리즈에서 제거할까요?')) {
            const { data } = await API.putPost('@' + this.state.username, url, 'series');
            if(data == 'DONE') {
                let { seriesPosts } = this.state;
                seriesPosts = seriesPosts.filter(post => (
                    post.url !== url
                ));
                this.setState({...this.state, seriesPosts});
                toast('😀 시리즈가 업데이트 되었습니다.');
            } else {
                toast('😯 변경중 오류가 발생했습니다.');
            }
        }
    }

    render() {
        const {
            seriesTitle,
            seriesDescription,
            seriesPosts
        } = this.state;

        const SereisModal = this.props.series.author == this.state.username ? (
            <Modal title="시리즈 수정" isOpen={this.state.isSereisModalOpen} close={() => this.onCloseModal('isSereisModalOpen')}>
                <div className="content">
                    <div className="input-group mb-3 mr-sm-2 mt-3">
                        <div className="input-group-prepend">
                            <div className="input-group-text">시리즈명</div>
                        </div>
                        <input
                            type="text"
                            name="seriesTitle"
                            value={seriesTitle}
                            placeholder="시리즈의 이름"
                            className="form-control"
                            maxLength={50}
                            required
                            onChange={(e) => this.onInputChange(e)}
                        />
                    </div>
                    <textarea
                        name="seriesDescription"
                        cols={40}
                        rows={5}
                        placeholder="설명을 작성하세요."
                        className="form-control"
                        onChange={(e) => this.onInputChange(e)}
                        value={seriesDescription}
                    />
                    {seriesPosts.map((post, idx) => (
                        <div key={idx} className="blex-card p-3 mt-3 noto d-flex justify-content-between">
                            <span className="deep-dark">
                                {idx + 1}. {post.title}
                            </span>
                            <a onClick={() => this.onPostsRemoveInSeries(post.url)}>
                                <i className="fas fa-times"></i>
                            </a>
                        </div>
                    ))}
                </div>
                <div className="button" onClick={() => this.seriesUpdate()}>
                    <button>시리즈를 수정합니다</button>
                </div>
            </Modal>
        ) : '';

        return (
            <>
                <Head>
                    <title>{this.props.series.author} — '{this.props.series.title}' 시리즈</title>
                </Head>

                {SereisModal}
                
                <div className="container">
                    <div className="back-image series-title-image" style={{backgroundImage: `url(${this.props.series.image})`}}>
                        <div className="fade-mask"></div>
                    </div>
                    <div className="series-list">
                        <div className="col-lg-8 mx-auto">
                            <h2 className="serif font-weight-bold">
                                '{seriesTitle}' 시리즈
                            </h2>
                            <Link href="/[author]" as={`/@${this.props.series.author}`}>
                                <a className="post-series deep-dark serif font-weight-bold mb-3">
                                    Created by {this.props.series.author}
                                </a>
                            </Link>
                            {this.props.series.author == this.state.username ? (
                                <div className="mb-3">
                                    <div className="btn btn-block btn-dark noto" onClick={() => this.onOpenModal('isSereisModalOpen')}>시리즈 수정</div>
                                </div>
                            ) : ''}
                            <SeriesDesc {...this.props.series}/>
                            {seriesPosts.map((post, idx) => (
                                <div key={idx} className="mb-5">
                                    <h5 className="card-title serif font-weight-bold">
                                        <Link href="/[author]/[posturl]" as={`/@${this.props.series.author}/${post.url}`}>
                                            <a className="deep-dark">{idx + 1}. {post.title}</a>
                                        </Link>
                                    </h5>
                                    <p>
                                        <Link href="/[author]/[posturl]" as={`/@${this.props.series.author}/${post.url}`}>
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