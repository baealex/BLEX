import React, { useState } from 'react';
import Link from 'next/link';
import ReactFrappeChart from 'react-frappe-charts';
import { toast } from 'react-toastify';

import Modal from '@components/modal/Modal';
import ModalContent from '@components/modal/Content';
import SettingLayout from '@components/setting/layout';
import {
    Arcodian
} from '@components/integrated'

import * as API from '@modules/api';

import { GetServerSidePropsContext } from 'next';

interface Props extends API.SettingPostsData {}

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const { req, res } = context;
    if(!req.headers.cookie) {
        res.writeHead(302, { Location: '/' });
        res.end();
    }
    const { data } = await API.getSetting(req.headers.cookie, 'posts');
    if(data === API.ERROR.NOT_LOGIN) {
        res.writeHead(302, { Location: '/' });
        res.end();
    }
    return {props: data};
}

function sorted(key: string, list: any) {
    return list.sort((left: any, right: any) => left[key] > right[key] ? -1 : left[key] < right[key] ? 1 : 0);
}

function trendy(list: any) {
    return list.sort((left: any, right: any) => {
        const lt = left.today;
        const ly = left.yesterday !== 0 ? left.yesterday : 1;
        const li = lt / ly;

        const rt = right.today;
        const ry = right.yesterday !== 0 ? right.yesterday : 1;
        const ri = rt / ry;

        return li > ri ? -1 : li < ri ? 1 : 0;
    });
}

export default function Setting(props: Props) {
    const [ isModalOpen, setModalOpen ] = useState(false);
    const [ selectedTag, setSelectedTag ] = useState('');

    const [ search, setSearch ] = useState('');
    const [ posts, setPosts ] = useState(props.posts);

    const [ apNow, setApNow ] = useState('');
    const [ analytics, setAnalytics ] = useState(Object());

    let renderPosts = posts;

    const tags = Array.from(posts.reduce((acc, cur) => {
        for(const tag of cur.fixedTag.split(',')) {
            acc.has(tag) ?
                acc.set(tag, acc.get(tag) + 1) :
                acc.set(tag, 1);
        }
        return acc;
    }, new Map()).entries()).sort((x, y) => x[1] < y[1] ? 1 : -1);

    if(search) {
        renderPosts = posts.filter(post =>
            post.title.toLowerCase().includes(search.toLowerCase())
        );
    }

    if(selectedTag) {
        renderPosts = renderPosts.filter(post => 
            post.fixedTag.includes(selectedTag)
        );
    }

    const postsAnalytics = async (url: string) => {
        setApNow(url);
        if(!analytics[url]) {
            const { data } = await API.getAnalytics('@' + props.username, url);
            const dates = [];
            const counts = [];
            for(const item of data.items) {
                dates.push(item.date.slice(-2) + 'th');
                counts.push(item.count);
            }
            dates.reverse();
            counts.reverse();
            const { referers } = data;
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
            const { data } = await API.deletePost('@' + props.username, url);
            if(data == 'DONE') {
                setPosts([...posts.filter(post => (
                    post.url !== url
                ))]);
                toast('😀 포스트가 삭제되었습니다.');
            }   
        }
    };

    const onPostsHide = async (url: string) => {
        const { data } = await API.putPost('@' + props.username, url, 'hide');
        setPosts([...posts.map(post => (
            post.url == url ? ({
                ...post,
                isHide: data.isHide
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

    const onTagSubmit = async (author: string, url: string) => {
        const thisPost = posts.find(post => post.url == url);
        const { data } = await API.putPost('@' + author, url, 'tag', {
            tag: thisPost?.tag
        });
        setPosts([...posts.map(post => (
            post.url == url ? ({
                ...post,
                tag: data.tag,
                fixedTag: data.tag
            }) : post
        ))]);
        toast('😀 태그가 수정되었습니다.');
    };

    return (
        <>
            <SettingLayout tabname="posts" sticky={false} sideChildren={(
                <div className="noto blex-card my-3">
                    <Arcodian>
                        <ul className="nav d-block">
                            <li className="nav-item">
                                <span
                                    onClick={() => setSelectedTag('')}
                                    className={`nav-link c-pointer ${selectedTag ? 'shallow' : 'deep'}-dark`}
                                >
                                    전체 ({posts.length})
                                </span>
                            </li>
                            {tags.map((item, idx) => (
                                <li key={idx} className="nav-item">
                                    <span
                                        onClick={() => setSelectedTag(item[0])}
                                        className={`nav-link c-pointer ${selectedTag == item[0] ? 'deep' : 'shallow'}-dark`}
                                    >
                                        {item[0]} ({item[1]})
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </Arcodian>
                </div>
            )}>
                <ul className="tag-list mb-0">
                    <li><a onClick={() => setPosts([...sorted('title', posts).reverse()])}>가나다</a></li>
                    <li><a onClick={() => setPosts([...sorted('createdDate', posts)])}>최근 작성</a></li>
                    <li><a onClick={() => setPosts([...sorted('updatedDate', posts)])}>최근 수정</a></li>
                    <li><a onClick={() => setPosts([...sorted('today', posts)])}>오늘 조회수 높은</a></li>
                    <li><a onClick={() => setPosts([...sorted('yesterday', posts)])}>어제 조회수 높은</a></li>
                    <li><a onClick={() => setPosts([...trendy(posts)])}>조회수 급상승</a></li>
                    <li><a onClick={() => setPosts([...sorted('totalLikes', posts)])}>추천 많은</a></li>
                    <li><a onClick={() => setPosts([...sorted('totalComments', posts)])}>댓글 많은</a></li>
                    <li><a onClick={() => setPosts([...sorted('isHide', posts)])}>숨김 우선</a></li>
                    <li><a onClick={() => setPosts([...sorted('tag', posts)].reverse())}>태그</a></li>
                </ul>
                <input
                    name="search"
                    className="form-control my-3"
                    placeholder="검색어를 입력하세요."
                    value={search}
                    onChange={(e) => {setSearch(e.target.value)}}
                />
                <ul className="list-group">
                {renderPosts.map((post, idx) => (
                    <li key={idx} className="blex-card p-3 mb-3">
                        <p className="d-flex justify-content-between">
                            <a className="deep-dark" href={`/@${props.username}/${post.url}`} target="_blank">
                                {post.title}
                            </a>
                            <a onClick={() => onPostsDelete(post.url)}>
                                <i className="fas fa-times"></i>
                            </a>
                        </p>
                        <ul className="setting-list-info">
                            <li onClick={() => onPostsHide(post.url)} className="element-lock c-pointer">
                                {post.isHide ? <i className="fas fa-lock"></i> : <i className="fas fa-lock-open"></i>}
                            </li>
                            <li className="c-pointer">
                                <Link href="/[author]/[posturl]/edit" as={`/@${props.username}/${post.url}/edit`}>
                                    <i className="far fa-edit"></i>
                                </Link>
                            </li>
                            <li>
                                <i className="far fa-eye"></i> <span className="ns">(Today : {post.today}, Yesterday : {post.yesterday})</span>
                            </li>
                            <li>
                                <i className="far fa-heart"></i> {post.totalLikes}
                            </li>
                            <li>
                                <i className="far fa-comment"></i> {post.totalComments}
                            </li>
                            <li>
                                <a onClick={() => postsAnalytics(post.url)}>
                                    <i className="fas fa-chart-line"></i>
                                </a>
                            </li>
                        </ul>
                        <div className="input-group mt-3 mr-sm-2">
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
                                <button type="button" className="btn btn-dark" onClick={() => onTagSubmit(props.username, post.url)}>
                                    <i className="fas fa-sign-in-alt"></i>
                                </button>
                            </div>
                        </div>
                    </li>
                ))}
                </ul>
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