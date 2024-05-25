import React, {
    useEffect,
    useRef,
    useState
} from 'react';
import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';

import {
    Alert,
    BaseInput,
    Button,
    Card,
    Dropdown,
    Flex,
    FormControl
} from '~/components/design-system';
import type { PageComponent } from '~/components';
import { Pagination } from '~/components/system-design/shared';
import { SettingLayout } from '~/components/system-design/setting';

import * as API from '~/modules/api';
import { message } from '~/modules/utility/message';
import { snackBar } from '~/modules/ui/snack-bar';

import { useFetch } from '~/hooks/use-fetch';

interface Props extends API.GetSettingPostsResponseData {
    page: number;
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ req, query }) => {
    const { page = 1, order = '', tag = '', series = '', search = '' } = query;

    const { data } = await API.getSettingPosts(
        {
            tag: String(tag),
            series: String(series),
            search: String(search),
            order: String(order),
            page: Number(page)
        },
        {
            'Cookie': req.headers.cookie || ''
        }
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
        name: '제목 (ㄱ-ㅎ)',
        order: 'title'
    },
    {
        name: '제목 (ㅎ-ㄱ)',
        order: '-title'
    },
    {
        name: '작성일 (과거부터)',
        order: 'created_date'
    },
    {
        name: '작성일 (최신부터)',
        order: '-created_date'
    },
    {
        name: '수정일 (과거부터)',
        order: 'updated_date'
    },
    {
        name: '수정일 (최신부터)',
        order: '-updated_date'
    },
    {
        name: '추천 적은 순',
        order: 'count_likes'
    },
    {
        name: '추천 많은 순',
        order: '-count_likes'
    },
    {
        name: '분량 적은 순',
        order: 'read_time'
    },
    {
        name: '분량 많은 순',
        order: '-read_time'
    },
    {
        name: '댓글 적은 순',
        order: 'count_comments'
    },
    {
        name: '댓글 많은 순',
        order: '-count_comments'
    },
    {
        name: '오늘 적게 조회된 순',
        order: 'today_count'
    },
    {
        name: '오늘 많이 조회된 순',
        order: '-today_count'
    },
    {
        name: '어제 적게 조회된 순',
        order: 'yesterday_count'
    },
    {
        name: '어제 많이 조회된 순',
        order: '-yesterday_count'
    },
    {
        name: '숨긴 글',
        order: '-hide'
    },
    {
        name: '공개 글',
        order: 'hide'
    }
];

type Posts = API.GetSettingPostsResponseData['posts'][number] & {
    hasTagChanged?: boolean;
    hasSeriesChanged?: boolean;
};

const PostsSetting: PageComponent<Props> = (props) => {
    const router = useRouter();

    const [posts, setPosts] = useState<Posts[]>(props.posts);

    const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { data: tags } = useFetch(['tags'], async () => {
        const { data } = await API.getSettingTag();
        return data.body.tags;
    });

    const { data: series } = useFetch(['series'], async () => {
        const { data } = await API.getSettingSeries();
        return data.body.series;
    });

    const handleChangeOrder = (e: React.ChangeEvent<HTMLSelectElement>) => {
        router.replace({
            pathname: router.pathname,
            query: {
                ...router.query,
                page: 1,
                order: e.target.value
            }
        }, '', {
            scroll: false
        });
    };

    const handleChangeTagFilter = (e: React.ChangeEvent<HTMLSelectElement>) => {
        router.replace({
            pathname: router.pathname,
            query: {
                ...router.query,
                page: 1,
                tag: e.target.value
            }
        }, '', {
            scroll: false
        });
    };

    const handleChangeSeriesFilter = (e: React.ChangeEvent<HTMLSelectElement>) => {
        router.replace({
            pathname: router.pathname,
            query: {
                ...router.query,
                page: 1,
                series: e.target.value
            }
        }, '', {
            scroll: false
        });
    };

    const handleChangeSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (searchDebounce.current) {
            clearTimeout(searchDebounce.current);
        }

        searchDebounce.current = setTimeout(() => {
            router.replace({
                pathname: router.pathname,
                query: {
                    ...router.query,
                    page: 1,
                    search: e.target.value
                }
            }, '', {
                scroll: false
            });
        }, 300);
    };

    const handlePostsDelete = async (url: string) => {
        if (confirm(message('CONFIRM', '정말 이 포스트를 삭제할까요?'))) {
            const { data } = await API.deleteAnUserPosts('@' + props.username, url);
            if (data.status === 'DONE') {
                router.replace(router.asPath, '', {
                    scroll: false
                });
                snackBar(message('AFTER_REQ_DONE', '포스트가 삭제되었습니다.'));
            }
        }
    };

    const handlePostsHide = async (url: string) => {
        const { data } = await API.putAnUserPosts('@' + props.username, url, 'hide');
        setPosts((prevPosts) => [...prevPosts.map(post => post.url == url ? ({
            ...post,
            isHide: data.body.isHide!
        }) : post)]);
    };

    const handleTagChange = (url: string, value: string, hasChanged = true) => {
        setPosts((prevPosts) => [...prevPosts.map(post => post.url == url ? ({
            ...post,
            tag: value,
            hasTagChanged: hasChanged
        }) : post)]);
    };

    const handleTagSubmit = async (url: string) => {
        const thisPost = posts.find(post => post.url == url);
        const { data } = await API.putAnUserPosts('@' + props.username, url, 'tag', {
            tag: thisPost?.tag
        });
        if (data.status === 'DONE' && data.body.tag) {
            handleTagChange(url, data.body.tag, false);
            snackBar(message('AFTER_REQ_DONE', '태그가 수정되었습니다.'));
        }
    };

    const handleSeriesChange = (url: string, value: string, hasChanged = true) => {
        setPosts((prevPosts) => [...prevPosts.map(post => post.url == url ? ({
            ...post,
            series: value,
            hasSeriesChanged: hasChanged
        }) : post)]);
    };

    const handleSeriesSubmit = async (url: string) => {
        const thisPost = posts.find(post => post.url == url);
        const { data } = await API.putAnUserPosts('@' + props.username, url, 'series', {
            series: thisPost?.series
        });
        if (data.status === 'DONE') {
            handleSeriesChange(url, data.body.series || '', false);
            snackBar(message('AFTER_REQ_DONE', '시리즈가 수정되었습니다.'));
        }
    };

    useEffect(() => setPosts(props.posts), [props.posts]);

    return (
        <>
            <Flex className="mb-3" justify="between" wrap="wrap" gap={2}>
                <div
                    style={{
                        flex: '1',
                        minWidth: '200px'
                    }}>
                    <BaseInput
                        tag="select"
                        icon={<i className="fas fa-sort" />}
                        defaultValue={router.query.order as string || '-created_date'}
                        onChange={handleChangeOrder}>
                        {POSTS_ORDER.map((order, idx) => (
                            <option key={idx} value={order.order}>{order.name}</option>
                        ))}
                    </BaseInput>
                </div>
                <div
                    style={{
                        flex: '1',
                        minWidth: '200px'
                    }}>
                    {tags && (
                        <BaseInput
                            tag="select"
                            icon={<i className="fas fa-tag" />}
                            defaultValue={router.query.tag as string || ''}
                            onChange={handleChangeTagFilter}>
                            <option value="">태그 (미선택)</option>
                            {tags?.map((tag, idx) => (
                                <option key={idx} value={tag.name}>{tag.name} ({tag.count})</option>
                            ))}
                        </BaseInput>
                    )}
                </div>
                <div
                    style={{
                        flex: '1',
                        minWidth: '200px'
                    }}>
                    {series && (
                        <BaseInput
                            tag="select"
                            icon={<i className="fas fa-book" />}
                            defaultValue={router.query.tag as string || ''}
                            onChange={handleChangeSeriesFilter}>
                            <option value="">시리즈 (미선택)</option>
                            {series?.map((item, idx) => (
                                <option key={idx} value={item.url}>{item.title} ({item.totalPosts})</option>
                            ))}
                        </BaseInput>
                    )}
                </div>
            </Flex>
            <div className="mb-3">
                <BaseInput
                    tag="input"
                    icon={<i className="fas fa-search" />}
                    defaultValue={router.query.search as string || ''}
                    placeholder="검색어를 입력하세요."
                    onChange={handleChangeSearch}
                />
            </div>
            {posts.map((post, idx) => (
                <Card key={idx} isRounded hasBackground className="mb-4">
                    <div className="p-3">
                        <Flex justify="between">
                            <Link className="deep-dark" href={`/@${props.username}/${post.url}`}>
                                {post.title}
                            </Link>
                            <Dropdown
                                button={
                                    <i className="fas fa-ellipsis-v" />
                                }
                                menus={[
                                    {
                                        name: '분석',
                                        onClick: () => router.push(`/@${props.username}/${post.url}/analytics`)
                                    },
                                    {
                                        name: '수정',
                                        onClick: () => router.push(`/@${props.username}/${post.url}/edit`)
                                    },
                                    {
                                        name: '삭제',
                                        onClick: () => handlePostsDelete(post.url)
                                    }
                                ]}
                            />
                        </Flex>
                        <div className="mt-1">
                            <time className="post-date shallow-dark">
                                {post.createdDate}
                                {post.createdDate !== post.updatedDate && ` (Updated: ${post.updatedDate})`}
                            </time>
                        </div>
                        <FormControl className="mt-2">
                            <Flex justify="between" align="center" gap={2}>
                                <div
                                    style={{
                                        flex: '1'
                                    }}>
                                    <BaseInput
                                        tag="input"
                                        icon={<i className="fas fa-tag" />}
                                        value={post.tag}
                                        maxLength={50}
                                        onChange={(e) => handleTagChange(post.url, e.target.value)}
                                    />
                                </div>
                                {post.hasTagChanged && (
                                    <Button onClick={() => handleTagSubmit(post.url)}>
                                        업데이트
                                    </Button>
                                )}
                            </Flex>
                        </FormControl>
                        <FormControl className="mt-2">
                            <Flex justify="between" align="center" gap={2}>
                                <div
                                    style={{
                                        flex: '1'
                                    }}>
                                    <BaseInput
                                        tag="select"
                                        icon={<i className="fas fa-book" />}
                                        value={post.series}
                                        maxLength={50}
                                        onChange={(e) => handleSeriesChange(post.url, e.target.value)}>
                                        <option value="">선택하지 않음</option>
                                        {series?.map((item, idx) => (
                                            <option key={idx} value={item.url} selected={post.series === item.url}>
                                                {item.title}
                                            </option>
                                        ))}
                                    </BaseInput>
                                </div>
                                {post.hasSeriesChanged && (
                                    <Button onClick={() => handleSeriesSubmit(post.url)}>
                                        업데이트
                                    </Button>
                                )}
                            </Flex>
                        </FormControl>
                    </div>
                    {post.readTime > 30 && (
                        <Alert type="danger">
                            이 글은 너무 깁니다. 긴 글은 검색 엔진의 색인을 어렵게 만들고 사용자 접근성을 낮춥니다.
                        </Alert>
                    )}
                    <div className="setting-info p-3" >
                        <Flex justify="between" align="center" className="shallow-dark ns">
                            <ul className="none-list mb-0">
                                <li>
                                    <a onClick={() => handlePostsHide(post.url)} className="element-lock c-pointer">
                                        {post.isHide
                                            ? <i className="fas fa-lock" />
                                            : <i className="fas fa-lock-open" />
                                        }
                                    </a>
                                </li>
                                <li>
                                    <i className="far fa-heart" /> {post.countLikes}
                                </li>
                                <li>
                                    <i className="far fa-comment" /> {post.countComments}
                                </li>
                            </ul>
                            <span>
                                오늘 : {post.todayCount}, 어제 : {post.yesterdayCount}
                            </span>
                        </Flex>
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
    <SettingLayout active="posts">
        {page}
    </SettingLayout>
);

export default PostsSetting;
