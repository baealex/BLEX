import React, {
    useEffect,
    useState
} from 'react';
import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';

import {
    Alert,
    Card,
    Dropdown
} from '@design-system';
import type { PageComponent } from '~/components';
import { Pagination } from '@system-design/shared';
import { SettingLayout } from '@system-design/setting';
import { TagBadges } from '@system-design/tag';

import * as API from '~/modules/api';
import { message } from '~/modules/utility/message';
import { snackBar } from '~/modules/ui/snack-bar';

interface Props extends API.GetSettingPostsResponseData {
    page: number;
}

export const getServerSideProps: GetServerSideProps = async ({ req, query }) => {
    const { page = 1, order = '', tag_filter = '' } = query;

    const { data } = await API.getSettingPosts(
        {
            tag_filter: String(tag_filter),
            order: String(order),
            page: Number(page)
        },
        { 'Cookie': req.headers.cookie || '' }
    );
    if (data.status === 'ERROR') {
        return {
            redirect: {
                destination: '/',
                permanent: false
            }
        };
    }
    return {
        props: {
            page: Number(page),
            ...data.body
        }
    };
};

const POSTS_ORDER = [
    {
        name: '제목',
        order: '-title'
    },
    {
        name: '분량',
        order: '-read_time'
    },
    {
        name: '생성',
        order: '-created_date'
    },
    {
        name: '수정',
        order: '-updated_date'
    },
    {
        name: '추천',
        order: '-total_like_count'
    },
    {
        name: '댓글',
        order: '-total_comment_count'
    },
    {
        name: '숨김',
        order: '-hide'
    }
];

const PostsSetting: PageComponent<Props> = (props) => {
    const [ posts, setPosts ] = useState(props.posts);

    useEffect(() => setPosts(props.posts), [props.posts]);

    const router = useRouter();

    const onPostsDelete = async (url: string) => {
        if (confirm(message('CONFIRM', '정말 이 포스트를 삭제할까요?'))) {
            const { data } = await API.deleteAnUserPosts('@' + props.username, url);
            if (data.status === 'DONE') {
                router.replace(router.asPath, '', { scroll: false });
                snackBar(message('AFTER_REQ_DONE', '포스트가 삭제되었습니다.'));
            }
        }
    };

    const onPostsHide = async (url: string) => {
        const { data } = await API.putAnUserPosts('@' + props.username, url, 'hide');
        setPosts([...posts.map(post => (
            post.url == url ? ({
                ...post,
                isHide: data.body.isHide as boolean
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
        const { data } = await API.putAnUserPosts('@' + props.username, url, 'tag', { tag: thisPost?.tag });
        setPosts([...posts.map(post => (
            post.url == url ? ({
                ...post,
                tag: data.body.tag  as string,
                fixedTag: data.body.tag as string
            }) : post
        ))]);
        snackBar(message('AFTER_REQ_DONE', '태그가 수정되었습니다.'));
    };

    return (
        <>
            <TagBadges
                items={POSTS_ORDER.map((item) => (
                    <Link
                        href={{
                            query: {
                                ...router.query,
                                order: router.query.order === item.order
                                    ? item.order.replace('-' , '')
                                    : item.order,
                                page: 1
                            }
                        }}
                        scroll={false}>
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
                ))}
            />
            {posts.map((post, idx) => (
                <Card key={idx} isRounded hasBackground className="mb-4">
                    <div className="p-3 mb-1">
                        <div className="d-flex justify-content-between mb-1">
                            <span>
                                <Link href="/[author]/[posturl]" as={`/@${props.username}/${post.url}`}>
                                    <a className="deep-dark">
                                        {post.title}
                                    </a>
                                </Link>
                            </span>
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
                                        onClick: () => router.push(`/@${props.username}/${post.url}/analytics`)
                                    }
                                ]}
                            />
                        </div>
                        <div className="mb-1">
                            <time className="post-date shallow-dark">
                                {post.createdDate}
                                {post.createdDate !== post.updatedDate && ` (Updated: ${post.updatedDate})`}
                            </time>
                        </div>
                        <div className="input-group mt-2">
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
                                <button onClick={() => onTagSubmit(post.url)}>
                                    변경
                                </button>
                            </div>
                        </div>
                    </div>
                    {post.readTime > 30 && (
                        <Alert type="danger">
                            이 글은 너무 깁니다. 긴 글은 검색 엔진의 색인을 어렵게 만들고 사용자 접근성을 낮춥니다.
                        </Alert>
                    )}
                    <div className="setting-info p-3">
                        <div className="d-flex justify-content-between align-items-center shallow-dark ns">
                            <ul className="none-list mb-0">
                                <li>
                                    <a onClick={() => onPostsHide(post.url)} className="element-lock c-pointer">
                                        {post.isHide
                                            ? <i className="fas fa-lock"/>
                                            : <i className="fas fa-lock-open"/>
                                        }
                                    </a>
                                </li>
                                <li>
                                    <i className="far fa-heart"></i> {post.totalLikes}
                                </li>
                                <li>
                                    <i className="far fa-comment"></i> {post.totalComments}
                                </li>
                            </ul>
                            <span>
                                오늘 : {post.todayCount}, 어제 : {post.yesterdayCount}
                            </span>
                        </div>
                    </div>
                </Card>
            ))}
            <Pagination
                page={props.page}
                last={props.lastPage}
            />
        </>
    );
};

PostsSetting.pageLayout = (page) => (
    <SettingLayout active="posts" sticky={false}>
        {page}
    </SettingLayout>
);

export default PostsSetting;
