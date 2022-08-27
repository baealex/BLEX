import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import React from 'react';
import Router from 'next/router';

import {
    Button,
    Card,
    Modal
} from '@design-system';
import {
    Footer, SEO
} from '@system-design/shared';
import { SeriesArticleCard } from '@system-design/series';

import { snackBar } from '~/modules/ui/snack-bar';

import * as API from '~/modules/api';
import { getUserImage } from '~/modules/utility/image';

import { authStore } from '~/stores/auth';
import { configStore } from '~/stores/config';

export const getServerSideProps: GetServerSideProps = async (context) => {
    const { cookies } = context.req;
    configStore.serverSideInject(cookies);

    const {
        author = '', seriesurl = ''
    } = context.query;

    if (!author.includes('@')) {
        return { notFound: true };
    }

    try {
        const { data } = await API.getAnUserSeries(
            author.toString(),
            seriesurl.toString()
        );
        return { props: { series: data.body } };
    } catch (error) {
        return { notFound: true };
    }
};

interface Props {
    series: API.GetAnUserSeriesResponseData;
}

interface State {
    isLogin: boolean;
    username: string;
    seriesTitle: string;
    seriesDescription: string;
    seriesPosts: API.GetAnUserSeriesResponseData['posts'];
    isSeriesModalOpen: boolean;
    isSortOldFirst: boolean;
}

class Series extends React.Component<Props, State> {
    private authUpdateKey: string;
    private configUpdateKey: string;

    constructor(props: Props) {
        super(props);
        this.state = {
            isLogin: authStore.state.isLogin,
            username: authStore.state.username,
            seriesTitle: props.series.name,
            seriesDescription: props.series.description,
            seriesPosts: props.series.posts,
            isSeriesModalOpen: false,
            isSortOldFirst: configStore.state.isSortOldFirst
        };
        this.authUpdateKey = authStore.subscribe((state) => this.setState({
            isLogin: state.isLogin,
            username: state.username
        }));
        this.configUpdateKey = configStore.subscribe((state) => this.setState({ isSortOldFirst: state.isSortOldFirst }));
    }

    componentWillUnmount() {
        authStore.unsubscribe(this.authUpdateKey);
        configStore.unsubscribe(this.configUpdateKey);
    }

    componentDidUpdate(prevProps: Props) {
        if (
            prevProps.series.name !== this.props.series.name ||
            prevProps.series.description !== this.props.series.description ||
            prevProps.series.posts !== this.props.series.posts
        ) {
            this.setState({
                seriesTitle: this.props.series.name,
                seriesDescription: this.props.series.description,
                seriesPosts: this.props.series.posts
            });
        }
    }

    onOpenModal(modalName: 'isSeriesModalOpen') {
        this.setState({ [modalName]: true });
    }

    onCloseModal(modalName: 'isSeriesModalOpen') {
        this.setState({ [modalName]: false });
    }

    onInputChange(e: React.ChangeEvent<HTMLTextAreaElement> | React.ChangeEvent<HTMLInputElement>) {
        this.setState({
            ...this.state,
            [e.target.name]: e.target.value
        });
    }

    async seriesUpdate() {
        const { data } = await API.putUserSeries(
            '@' + this.props.series.owner,
            this.props.series.url,
            {
                title: this.state.seriesTitle,
                description: this.state.seriesDescription
            }
        );
        if (data.status === 'DONE') {
            if (data.body.url) {
                Router.replace(
                    '/[author]/series/[seriesurl]',
                    `/@${this.state.username}/series/${data.body.url}`
                );
            }
            this.onCloseModal('isSeriesModalOpen');
            snackBar('😀 시리즈가 업데이트 되었습니다.');
        } else {
            snackBar('😯 변경중 오류가 발생했습니다.');
        }
    }

    async onPostsRemoveInSeries(url: string) {
        if (confirm('😮 이 포스트를 시리즈에서 제거할까요?')) {
            const { data } = await API.putAnUserPosts('@' + this.props.series.owner, url, 'series');
            if (data.status === 'DONE') {
                let { seriesPosts } = this.state;
                seriesPosts = seriesPosts.filter(post => (
                    post.url !== url
                ));
                this.setState({ seriesPosts });
                snackBar('😀 시리즈가 업데이트 되었습니다.');
            } else {
                snackBar('😯 변경중 오류가 발생했습니다.');
            }
        }
    }

    render() {
        const {
            seriesTitle,
            seriesDescription,
            seriesPosts
        } = this.state;

        const SeriesModal = this.props.series.owner == this.state.username && (
            <Modal
                title="시리즈 수정"
                isOpen={this.state.isSeriesModalOpen}
                onClose={() => this.onCloseModal('isSeriesModalOpen')}
                submitText="시리즈를 수정합니다"
                onSubmit={() => this.seriesUpdate()}>
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
                    <Card key={idx} hasShadow isRounded className="p-3 mt-3">
                        <div className="d-flex justify-content-between">
                            <span className="deep-dark">
                                {idx + 1}. {post.title}
                            </span>
                            <a onClick={() => this.onPostsRemoveInSeries(post.url)}>
                                <i className="fas fa-times"></i>
                            </a>
                        </div>
                    </Card>
                ))}
            </Modal>
        );

        const { isSortOldFirst } = this.state;

        return (
            <>
                <SEO
                    title={`'${this.props.series.name}' 시리즈 — ${this.props.series.owner}`}
                    image={this.props.series.image}
                />

                {SeriesModal}

                <style jsx>{`
                    :global(main.content) {
                        padding-top: 0;
                        background-color: #F2F2F2;

                        :global(body.dark) & {
                            background-color: #151515;
                        }
                    }
                    
                    .series-header {
                        height: 380px;
                        background: #000;
                        width: 100%;
                        position: relative;

                        .series-header-content {
                            position: absolute;
                            top: calc(50% + 40px);
                            left: 50%;
                            transform: translate(-50%, -50%);
                            text-align: center;
                            color: #fff;
                            width: 100%;
                            max-width: 720px;
                            padding: 0 15px;

                            .series-title {
                                font-size: 2rem;
                                font-weight: bold;
                                margin-bottom: 1rem;
                                letter-spacing: -1px;

                                @media (max-width: 768px) {
                                    font-size: 1.5rem;
                                }
                            }

                            .series-description {
                                font-size: 1.2rem;
                                line-height: 1.5;
                                margin-bottom: 1rem;
                                word-break: keep-all;

                                @media (max-width: 768px) {
                                    font-size: 1rem;
                                    word-break: break-all;
                                }
                            }
                        }

                        .corner {
                            position: absolute;
                            bottom: 16px;
                            right: 16px;
                        }
                    }

                    .series-header::after {
                        content: '';
                        position: absolute;
                        bottom: -30px;
                        left: 50%;
                        transform: translateX(-50%);
                        width: 0;
                        height: 0;
                        border-style: solid;
                        border-width: 30px 30px 0 30px;
                        border-color: #000 transparent transparent transparent;
                    }

                    .user-image-wrapper {
                        width: 200px;
                        height: 200px;
                        border-radius: 100%;
                        overflow: hidden;
                        margin: 60px auto;

                        img {
                            width: 100%;
                            height: 100%;
                            object-fit: cover;

                            &:hover {
                                transform: scale(1.5);
                            }

                            transition: transform 0.2s ease-in-out;
                        }
                    }

                    .b-container {
                        padding: 0 15px;
                        width: 100%;
                        max-width: 600px;
                        margin: 0 auto;
                    }
                `}</style>

                <div className="series-header">
                    <div className="series-header-content">
                        <h1 className="series-title">“{this.props.series.name}” 시리즈</h1>
                        <p className="series-description">{this.props.series.description}</p>
                    </div>
                    {this.props.series.owner == this.state.username && (
                        <div className="corner">
                            <div className="btn btn-dark" onClick={() => this.onOpenModal('isSeriesModalOpen')}>
                                시리즈 수정
                            </div>
                        </div>
                    )}
                </div>

                <div className="user-image-wrapper">
                    <Link href={`/@${this.props.series.owner}`}>
                        <a>
                            <img src={getUserImage(this.props.series.ownerImage)} alt={this.props.series.name} />
                        </a>
                    </Link>
                </div>

                <div className="b-container">
                    <div className="mt-5 mb-3 text-right">
                        <Button
                            space="spare"
                            onClick={() => configStore.set((prevState) => ({
                                ...prevState,
                                isSortOldFirst: !isSortOldFirst
                            }))}>
                            {isSortOldFirst ? (
                                <>
                                    <i className="fas fa-sort-up"/> 과거부터
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-sort-down"/> 최근부터
                                </>
                            )}
                        </Button>
                    </div>
                    {isSortOldFirst ? seriesPosts.map((post, idx) => (
                        <SeriesArticleCard
                            key={idx}
                            idx={idx}
                            author={this.props.series.owner}
                            {...post}
                        />
                    )) : seriesPosts.map((post, idx) => (
                        <SeriesArticleCard
                            key={idx}
                            idx={idx}
                            author={this.props.series.owner}
                            {...post}
                        />
                    )).reverse()}
                </div>
                <Footer/>
            </>
        );
    }
}

export default Series;
