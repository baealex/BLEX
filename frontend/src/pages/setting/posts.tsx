import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

import ReactFrappeChart from 'react-frappe-charts';
import { toast } from 'react-toastify';

import Modal from '@components/modal/Modal';
import ModalContent from '@components/modal/Content';
import SettingLayout from '@components/setting/layout';
import {
    Pagination
} from '@components/common'

import * as API from '@modules/api';

import { GetServerSidePropsContext } from 'next';
import { Dropdown } from '@components/atoms';

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const {
        page = 1,
        order = '',
    } = context.query;

    const { req, res } = context;
    if(!req.headers.cookie) {
        res.writeHead(302, { Location: '/' });
        res.end();
    }
    const { data } = await API.getSettingPosts(
        req.headers.cookie,
        order as string,
        page as number
    );
    if(data.status === 'ERROR') {
        res.writeHead(302, { Location: '/' });
        res.end();
    }
    return {
        props: {
            page,
            ...data.body
        }
    };
}

const POSTS_ORDER = [
    {
        name: '제목',
        order: '-title',
    },
    {
        name: '분량',
        order: '-read_time',
    },
    {
        name: '생성',
        order: '-created_date',
    },
    {
        name: '수정',
        order: '-updated_date',
    },
    {
        name: '태그',
        order: '-tag',
    },
    {
        name: '추천',
        order: '-total_like_count',
    },
    {
        name: '댓글',
        order: '-total_comment_count',
    },
    {
        name: '숨김',
        order: '-hide',
    },
    {
        name: '오늘 조회수',
        order: '-today_count',
    },
    {
        name: '어제 조회수',
        order: '-yesterday_count',
    },
];

interface Props extends API.GetSettingPostsData {
    page: number;
}

export default function Setting(props: Props) {
    const [ isModalOpen, setModalOpen ] = useState(false);
    const [ posts, setPosts ] = useState(props.posts);

    const [ apNow, setApNow ] = useState('');
    const [ analytics, setAnalytics ] = useState(Object());

    useEffect(() => {
        setPosts(props.posts);
    }, [props.posts])

    const router = useRouter();

    const postsAnalytics = async (url: string) => {
        setApNow(url);
        if(!analytics[url]) {
            const { data } = await API.getPostAnalytics(url);
            const dates = [];
            const counts = [];
            for(const item of data.body.items) {
                dates.push(item.date.slice(-2) + 'th');
                counts.push(item.count);
            }
            dates.reverse();
            counts.reverse();
            const { referers } = data.body;
            setAnalytics({
                ...analytics,
                [url]: {
                    dates,
                    counts,
                    referers
                },
            });
        };
        setModalOpen(true);
    };

    const onPostsDelete = async (url: string) => {
        if(confirm('😮 정말 이 포스트를 삭제할까요?')) {
            const { data } = await API.deleteAnUserPosts('@' + props.username, url);
            if(data.status === 'DONE') {
                router.replace(router.asPath, '', { scroll: false });
                toast('😀 포스트가 삭제되었습니다.');
            }   
        }
    };

    const onPostsHide = async (url: string) => {
        const { data } = await API.putAnUserPosts('@' + props.username, url, 'hide');
        setPosts([...posts.map(post => (
            post.url == url ? ({
                ...post,
                isHide: data.body.isHide as boolean,
            }) : post
        ))]);
    };

    const onTagChange = (url: string, value: string) => {
        setPosts([...posts.map(post => (
            post.url == url ? ({
                ...post,
                tag: value
            }) : post
        ))]);
    };

    const onTagSubmit = async (url: string) => {
        const thisPost = posts.find(post => post.url == url);
        const { data } = await API.putAnUserPosts('@' + props.username, url, 'tag', {
            tag: thisPost?.tag
        });
        setPosts([...posts.map(post => (
            post.url == url ? ({
                ...post,
                tag: data.body.tag  as string,
                fixedTag: data.body.tag as string
            }) : post
        ))]);
        toast('😀 태그가 수정되었습니다.');
    };

    return (
        <>
            <SettingLayout tabname="posts" sticky={false}>
                <ul className="tag-list mb-3">
                    {POSTS_ORDER.map((item, idx) => (
                        <li key={idx}>
                            <Link href={{
                                query: {
                                    ...router.query,
                                    order: router.query.order === item.order
                                        ? item.order.replace('-' , '')
                                        : item.order,
                                    page: 1,
                                }
                            }}>
                                <a>
                                    {item.name}&nbsp;
                                    {router.query.order?.includes(item.order.replace('-' , '')) && (
                                        router.query.order?.includes('-') ? (
                                            <i className="fas fa-sort-up"/>
                                        ) : (
                                            <i className="fas fa-sort-down"/>
                                        )
                                    )}
                                </a>
                            </Link>
                        </li>
                    ))}
                </ul>
                <ul className="list-group">
                {posts.map((post, idx) => (
                    <li key={idx} className="blex-card p-3 mb-3">
                        {post.readTime > 30 && (
                            <div className="alert alert-danger mt-3">
                                이 글은 너무 깁니다. 긴 글은 검색 엔진의 색인을 어렵게 만들고 사용자 접근성을 낮춥니다.
                            </div>
                        )}
                        <div className="d-flex justify-content-between">
                            <Link href="/[author]/[posturl]" as={`/@${props.username}/${post.url}`}>
                                <a className="deep-dark">
                                    <b>{post.title}</b>
                                </a>
                            </Link>
                            <Dropdown
                                button={
                                    <i className="fas fa-ellipsis-v"></i>
                                }
                                menus={[
                                    {
                                        name: '수정',
                                        onClick: () => router.push(`/@${props.username}/${post.url}/edit`)
                                    },
                                    {
                                        name: '삭제',
                                        onClick: () => onPostsDelete(post.url)
                                    },
                                    {
                                        name: '분석',
                                        onClick: () => postsAnalytics(post.url)
                                    },
                                ]}
                            />
                        </div>
                        <time className="post-date">
                            {post.createdDate}
                            {post.createdDate !== post.updatedDate && ` (Updated: ${post.updatedDate})`}
                        </time>
                        <ul className="setting-list-info">
                            <li onClick={() => onPostsHide(post.url)} className="element-lock c-pointer">
                                {post.isHide ? <i className="fas fa-lock"></i> : <i className="fas fa-lock-open"></i>}
                            </li>
                            <li>
                                <i className="far fa-heart"></i> {post.totalLikes}
                            </li>
                            <li>
                                <i className="far fa-comment"></i> {post.totalComments}
                            </li>
                            <li>
                                <i className="far fa-eye"></i> <span className="ns">(Today : {post.todayCount}, Yesterday : {post.yesterdayCount})</span>
                            </li>
                        </ul>
                        <div className="input-group mt-2 mr-sm-2">
                            <div className="input-group-prepend">
                                <div className="input-group-text">#</div>
                            </div>
                            <input
                                type="text"
                                name="tag"
                                value={post.tag}
                                onChange={(e) => onTagChange(post.url, e.target.value)}
                                className="form-control"
                                maxLength={255}
                            />
                            <div className="input-group-prepend">
                                <button type="button" className="btn btn-dark" onClick={() => onTagSubmit(post.url)}>
                                    <i className="fas fa-sign-in-alt"></i>
                                </button>
                            </div>
                        </div>
                    </li>
                ))}
                </ul>
                <Pagination
                    page={props.page}
                    last={props.lastPage}
                />
            </SettingLayout>
            <Modal title="포스트 분석" isOpen={isModalOpen} close={() => setModalOpen(false)}>
                <ModalContent>
                    <>
                        {analytics[apNow] ? (
                            <>
                                <ReactFrappeChart
                                    type="axis-mixed"
                                    data={{
                                        labels: analytics[apNow].dates,
                                        datasets: [
                                            {
                                                name: 'View',
                                                values: analytics[apNow].counts,
                                                chartType: 'line'
                                            }
                                        ]
                                    }}
                                    colors={['purple']}
                                />
                                <ul>
                                    {analytics[apNow].referers.map((item: any, idx: number) => (
                                        <li key={idx}>{item.time} - <a className="shallow-dark" href={item.from} target="blank">{item.title ? item.title : item.from}</a></li>
                                    ))}
                                </ul>
                            </>
                        ) : ''}
                    </>
                </ModalContent>
            </Modal>
        </>
    );
}