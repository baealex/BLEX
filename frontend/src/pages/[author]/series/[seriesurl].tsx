import React, { useEffect, useState } from 'react';
import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import Router from 'next/router';
import { useStore } from 'badland-react';

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
import { lazyLoadResource } from '~/modules/optimize/lazy';

import { authStore } from '~/stores/auth';
import { configStore } from '~/stores/config';

import { useForm } from '~/hooks/use-form';
import { useInfinityScroll } from '~/hooks/use-infinity-scroll';
import { useMemoryStore } from '~/hooks/use-memory-store';

interface Props {
    series: API.GetAnUserSeriesResponseData;
}

export const getServerSideProps: GetServerSideProps = async (context) => {
    const { cookies } = context.req;
    configStore.serverSideInject(cookies);

    const {
        author = '',
        seriesurl = ''
    } = context.query;

    if (!author.includes('@')) {
        return { notFound: true };
    }

    try {
        const { data } = await API.getAnUserSeries('' + author, '' + seriesurl, {
            page: 1
        });
        return {
            props: {
                series: data.body
            }
        };
    } catch (error) {
        return { notFound: true };
    }
};

interface Form {
    title: string;
    description: string;
}

export default function Series(props: Props) {
    const memoryStore = useMemoryStore([props.series.url], {
        page: 1,
        posts: props.series.posts
    });

    const [{ username }] = useStore(authStore);

    const [posts, setPosts] = useState<API.GetAnUserSeriesResponseData['posts']>(memoryStore.posts);
    const [page, setPage] = useState(memoryStore.page);

    const [isOpenSeriesUpdateModal, setIsOpenSeriesUpdateModal] = useState(false);

    useEffect(lazyLoadResource, [posts]);

    useInfinityScroll(async () => {
        if (props.series.lastPage <= page) {
            return;
        }

        const { data } = await API.getAnUserSeries('@' + props.series.owner, props.series.url, {
            page: page + 1
        });

        if (data.status === 'DONE') {
            setPage((prevPage) => {
                memoryStore.page = prevPage + 1;
                return memoryStore.page;
            });
            setPosts((prevPosts) => {
                memoryStore.posts = [...prevPosts, ...data.body.posts];
                return memoryStore.posts;
            });
        }
    });

    const { register, handleSubmit } = useForm<Form>();

    const handleSeriesUpdate = handleSubmit(async (formData) => {
        const { data } = await API.putUserSeries('@' + props.series.owner, props.series.url, formData);

        if (data.status === 'DONE') {
            Router.replace(`/@${username}/series/${data.body.url}`);
            setIsOpenSeriesUpdateModal(false);
            snackBar('😀 시리즈가 업데이트 되었습니다.');
        } else {
            snackBar('😯 변경중 오류가 발생했습니다.');
        }
    });

    const handleRemovePosts = async (url: string) => {
        if (confirm('😮 이 포스트를 시리즈에서 제거할까요?')) {
            const { data } = await API.putAnUserPosts('@' + props.series.owner, url, 'series');
            if (data.status === 'DONE') {
                setPosts((prevPosts) => prevPosts.filter(post => (
                    post.url !== url
                )));
                snackBar('😀 시리즈가 업데이트 되었습니다.');
            } else {
                snackBar('😯 변경중 오류가 발생했습니다.');
            }
        }
    };

    const SeriesUpdateModal = () => (
        <Modal
            title="시리즈 수정"
            isOpen={isOpenSeriesUpdateModal}
            onClose={() => setIsOpenSeriesUpdateModal(false)}
            submitText="시리즈를 수정합니다"
            onSubmit={handleSeriesUpdate}>
            <div className="input-group mb-3 mr-sm-2 mt-3">
                <div className="input-group-prepend">
                    <div className="input-group-text">시리즈명</div>
                </div>
                <input
                    {...register('title')}
                    type="text"
                    placeholder="시리즈의 이름"
                    className="form-control"
                    maxLength={50}
                    required
                    defaultValue={props.series.name}
                />
            </div>
            <textarea
                {...register('description')}
                cols={40}
                rows={5}
                placeholder="설명을 작성하세요."
                className="form-control"
                defaultValue={props.series.description}
            />
            {posts.map((post, idx) => (
                <Card key={post.url} hasShadow isRounded className="p-3 mt-3">
                    <div className="d-flex justify-content-between">
                        <span className="deep-dark">
                            {idx + 1}. {post.title}
                        </span>
                        <a onClick={() => handleRemovePosts(post.url)}>
                            <i className="fas fa-times"></i>
                        </a>
                    </div>
                </Card>
            ))}
        </Modal>
    );

    return (
        <>
            <SEO
                title={`'${props.series.name}' 시리즈 — ${props.series.owner}`}
                image={props.series.image}
            />

            {props.series.owner === username && (
                <SeriesUpdateModal />
            )}

            <div className="series-header">
                <div className="series-header-content">
                    <h1 className="series-title">“{props.series.name}” 시리즈</h1>
                    <p className="series-description">{props.series.description}</p>
                </div>
                {props.series.owner == username && (
                    <div className="corner">
                        <Button onClick={() => setIsOpenSeriesUpdateModal(true)}>
                            시리즈 수정
                        </Button>
                    </div>
                )}
            </div>

            <div className="user-image-wrapper">
                <Link href={`/@${props.series.owner}`}>
                    <img src={getUserImage(props.series.ownerImage)} alt={props.series.name} />
                </Link>
            </div>

            <div className="b-container">
                <div className={'series-list'}>
                    {posts.map((post) => (
                        <SeriesArticleCard
                            key={post.url}
                            author={props.series.owner}
                            {...post}
                        />
                    ))}
                </div>
            </div>
            <Footer isDark />

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

                .series-list {
                    display: flex;
                    flex-direction: column;

                    &.reversed {
                        flex-direction: column-reverse;
                    }
                }
            `}</style>
        </>
    );
}
