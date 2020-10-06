import Link from 'next/link';
import Head from 'next/head';
import React from 'react';
import Router from 'next/router';

import { toast } from 'react-toastify';

import API from '../../../modules/api';
import Global from '../../../modules/global';
import Modal from '../../../components/common/Modal';

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
        this.state = {
            isLogin: Global.state.isLogin,
            username: Global.state.username,
            seriesUrl: props.series.url,
            seriesTitle: props.series.title,
            seriesDescription: props.series.description,
            isSereisModalOpen: false
        }
        Global.appendUpdater('Series', () => this.setState({
            ...this.state,
            isLogin: Global.state.isLogin,
            username: Global.state.username
        }));
    }

    onOpenModal(modalName) {
        let newState = this.state;
        newState[modalName] = true;
        this.setState(newState);
    }

    onCloseModal(modalName) {
        let newState = this.state
        newState[modalName] = false
        this.setState(newState);
    }

    onInputChange(e) {
        let newState = this.state;
        newState[e.target.name] = e.target.value;
        this.setState(newState);
    }

    async seriesUpdate() {
        const { data } = await API.putSeries(
            '@' + this.props.series.owner,
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
            toast('😄 정상적으로 변경되었습니다.');
        } else {
            toast('😯 변경중 오류가 발생했습니다.');
        }
    }

    render() {
        const SereisModal = this.props.series.owner == this.state.username ? (
            <Modal title="시리즈 수정" isOpen={this.state.isSereisModalOpen} close={() => this.onCloseModal('isSereisModalOpen')}>
                <div className="content">
                    <div className="input-group mb-3 mr-sm-2 mt-3">
                        <div className="input-group-prepend">
                            <div className="input-group-text">시리즈명</div>
                        </div>
                        <input
                            type="text"
                            name="seriesTitle"
                            value={this.state.seriesTitle}
                            placeholder="시리즈의 이름"
                            className="form-control"
                            maxLength="50"
                            required
                            onChange={(e) => this.onInputChange(e)}
                        />
                    </div>
                    <textarea
                        name="seriesDescription"
                        cols="40"
                        rows="5"
                        placeholder="설명을 작성하세요."
                        className="form-control"
                        onChange={(e) => this.onInputChange(e)}
                        value={this.state.seriesDescription}
                    />
                </div>
                <div className="button" onClick={() => this.seriesUpdate()}>
                    <button>완료</button>
                </div>
            </Modal>
        ) : '';

        return (
            <>
                <Head>
                    <title>{this.props.series.owner} — '{this.props.series.title}' 시리즈</title>
                </Head>

                {SereisModal}
                
                <div className="container">
                    <div className="back-image series-title-image" style={{backgroundImage: `url(${this.props.series.image})`}}>
                        <div className="fade-mask"></div>
                    </div>
                    <div className="series-list">
                        <div className="col-lg-8 mx-auto">
                            <h2 className="serif font-weight-bold">
                                '{this.state.seriesTitle}' 시리즈
                            </h2>
                            <Link href="/[author]" as={`/@${this.props.series.owner}`}>
                                <a className="post-series deep-dark serif font-weight-bold mb-3">
                                    Created by {this.props.series.owner}
                                </a>
                            </Link>
                            {this.props.series.owner == this.state.username ? (
                                <div className="mb-3">
                                    <div className="btn btn-dark m-1" onClick={() => this.onOpenModal('isSereisModalOpen')}>수정</div>
                                    <div className="btn btn-dark m-1">삭제</div>
                                </div>
                            ) : ''}
                            <div className="series-desc mb-4">
                                <blockquote className="noto">
                                    {this.state.seriesDescription ? this.state.seriesDescription : '이 시리즈에 대한 설명이 없습니다.'}
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
                                <div key={idx} className="mb-5">
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