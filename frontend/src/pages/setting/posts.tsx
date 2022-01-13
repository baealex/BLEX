import React, {
    useCallback,
    useEffect,
    useState
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

import ReactFrappeChart from 'react-frappe-charts';
import { snackBar } from '@modules/snack-bar';

import {
    Alert,
    Card,
    Dropdown,
    Modal,
} from '@design-system';
import { Layout } from '@components/setting';
import { TagBadge } from '@components/tag';

import { getLocache, setLocache } from '@modules/locache';
import {
    deleteAnUserPosts,
    getPostAnalytics,
    getSettingPosts,
    putAnUserPosts,
    GetSettingPostsData
} from '@modules/api';

import { GetServerSidePropsContext } from 'next';

import { authContext } from '@state/auth';
import { loadingContext } from '@state/loading';

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const { req, res } = context;
    if(!req.headers.cookie) {
        res.writeHead(302, { Location: '/' });
        res.end();
    }
    return {
        props: {}
    };
}

const POSTS_ORDER = [
    {
        name: '제목',
        order: 'title',
    },
    {
        name: '분량',
        order: 'readTime',
    },
    {
        name: '생성',
        order: 'createdDate',
    },
    {
        name: '수정',
        order: 'updatedDate',
    },
    {
        name: '태그',
        order: 'tag',
    },
    {
        name: '추천',
        order: 'totalLikes',
    },
    {
        name: '댓글',
        order: 'totalComments',
    },
    {
        name: '숨김',
        order: 'isHide',
    },
    {
        name: '오늘 조회수',
        order: 'todayCount',
    },
    {
        name: '어제 조회수',
        order: 'yesterdayCount',
    },
];

export default function PostsSetting() {
    const [ username , setUsername ] = useState(authContext.state.username);
    const [ order , setOrder ] = useState('');
    const [ search, setSearch ] = useState('');

    const [ isModalOpen, setModalOpen ] = useState(false);
    const [ posts, setPosts ] = useState<GetSettingPostsData[]>([]);

    const [ apNow, setApNow ] = useState('');
    const [ analytics, setAnalytics ] = useState(Object());

    useEffect(authContext.syncValue('username', setUsername), []);

    useEffect(() => {
        loadingContext.start();

        const initPosts = async () => {
            const { data } = await getSettingPosts();
            return data.body;
        }

        getLocache({
            key: 'settingPostsOrder',
            owner: username,
            refreshSeconds: 60 * 5,
        }, () => '').then(setOrder);

        getLocache({
            key: 'settingPosts',
            owner: username,
            refreshSeconds: 60 * 5,
        }, initPosts).then((posts) => {
            setPosts(posts);
            loadingContext.end();
        });
    }, [])

    useEffect(() => {
        setLocache({
            key: 'settingPostsOrder',
            owner: username,
        }, order);

        const shouldReverse = order.includes('-');
        const orderName = order.replace('-', '') as keyof GetSettingPostsData;

        setPosts((prevPosts) => {
            return [...prevPosts].sort((a, b) => {
                if (shouldReverse) {
                    return a[orderName] > b[orderName] ? 1 : -1    
                }
                return a[orderName] > b[orderName] ? -1 : 1
            });
        })
    }, [username, order])

    useEffect(() => {
        setLocache({
            key: 'settingPosts',
            owner: username,
        }, posts);
    }, [username, posts])

    const router = useRouter();

    const postsAnalytics = useCallback(async (url: string) => {
        setApNow(url);
        if (!analytics[url]) {
            const { data } = await getPostAnalytics(url);
            const { items, referers } = data.body;

            const dates = [];
            const counts = [];

            for (const item of items) {
                dates.unshift(item.date.slice(-2));
                counts.unshift(item.count);
            }

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
    }, []);

    const handlePostsDelete = useCallback(async (username: string, url: string) => {
        if (confirm('😮 정말 이 포스트를 삭제할까요?')) {
            const { data } = await deleteAnUserPosts('@' + username, url);
            
            if (data.status === 'DONE') {
                setPosts((prevPosts) => [...prevPosts.filter(
                    post => post.url != url
                )]);
                snackBar('😀 포스트가 삭제되었습니다.');
            }   
        }
    }, []);

    const handlePostsHide = useCallback(async (username: string, url: string) => {
        const { data } = await putAnUserPosts('@' + username, url, 'hide');
        setPosts(prevPosts => [...prevPosts.map(post => (
            post.url == url ? ({
                ...post,
                isHide: data.body.isHide as boolean,
            }) : post
        ))]);
    }, []);

    const handleTagValueChange = useCallback((url: string, value: string) => {
        setPosts(prevPosts => [...prevPosts.map(post => (
            post.url == url ? ({
                ...post,
                tag: value
            }) : post
        ))]);
    }, []);

    const handleTagSubmit = useCallback(async (username: string, url: string, tag: string) => {
        const { data } = await putAnUserPosts('@' + username, url, 'tag', {
            tag
        });

        setPosts(prevPosts => [...prevPosts.map(post => (
            post.url == url ? ({
                ...post,
                tag: data.body.tag || '',
            }) : post
        ))]);
        snackBar('😀 태그가 수정되었습니다.');
    }, []);

    return (
        <>
            <TagBadge items={POSTS_ORDER.map((item) => (
                <a onClick={() => order != item.order
                    ? setOrder(item.order)
                    : setOrder('-' + item.order)}
                >
                    {item.name}&nbsp;
                    {order.includes(item.order.replace('-' , '')) && (
                        order.includes('-') ? (
                            <i className="fas fa-sort-down"/>
                        ) : (
                            <i className="fas fa-sort-up"/>
                        )
                    )}
                </a>
            ))}/>
            <div className="input-group mb-3">
                <input
                    type="text"
                    placeholder="포스트 검색"
                    className="form-control"
                    maxLength={50}
                    onChange={(e) => setSearch(e.target.value)}
                    value={search}
                />
            </div>
            <>
                {posts.filter(post => post.title.toLowerCase().includes(search)).map((post, idx) => (
                    <Card key={idx} hasShadow isRounded className="mb-3">
                        <div className="p-3 mb-1">
                            <div className="d-flex justify-content-between mb-1">
                                <span>
                                    <Link href="/[author]/[posturl]" as={`/@${username}/${post.url}`}>
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
                                            onClick: () => router.push(`/@${username}/${post.url}/edit`)
                                        },
                                        {
                                            name: '삭제',
                                            onClick: () => handlePostsDelete(username, post.url)
                                        },
                                        {
                                            name: '분석',
                                            onClick: () => postsAnalytics(post.url)
                                        },
                                    ]}
                                />
                            </div>
                            <div className="mb-1">
                                <time className="post-date shallow-dark">
                                    {post.createdDate}
                                    {post.createdDate !== post.updatedDate && ` (Updated: ${post.updatedDate})`}
                                </time>
                            </div>
                            <div className="input-group mt-2 mr-sm-2">
                                <div className="input-group-prepend">
                                    <div className="input-group-text">#</div>
                                </div>
                                <input
                                    type="text"
                                    name="tag"
                                    value={post.tag}
                                    onChange={(e) => handleTagValueChange(post.url, e.target.value)}
                                    className="form-control"
                                    maxLength={255}
                                />
                                <div className="input-group-prepend">
                                    <button
                                        type="button"
                                        className="btn btn-dark"
                                        onClick={() => handleTagSubmit(username, post.url, post.tag)}
                                    >
                                        변경
                                    </button>
                                </div>
                            </div>
                        </div>
                        <>
                            {post.readTime > 30 && (
                                <Alert type="danger">
                                    이 글은 너무 깁니다. 긴 글은 검색 엔진의 색인을 어렵게 만들고 사용자 접근성을 낮춥니다.
                                </Alert>
                            )}
                        </>
                        <div className="setting-info p-3">
                            <div className="d-flex justify-content-between align-items-center shallow-dark ns">
                                <ul className="none-list mb-0">
                                    <li>
                                        <a onClick={() => handlePostsHide(username, post.url)} className="element-lock c-pointer">
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
            </>
            <Modal
                title="포스트 분석"
                isOpen={isModalOpen}
                onClose={() => setModalOpen(false)}
            >
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
                                colors={['#A076F1']}
                            />
                            <ul>
                                {analytics[apNow].referers.map((item: any, idx: number) => (
                                    <li key={idx}>
                                        {item.time} - <a className="shallow-dark" href={item.from} target="blank">{item.title ? item.title : item.from}</a>
                                    </li>
                                ))}
                            </ul>
                        </>
                    ) : ''}
                </>
            </Modal>
        </>
    );
}

PostsSetting.pageLayout = (page: JSX.Element) => (
    <Layout tabname="posts" sticky={false}>
        {page}
    </Layout>
)