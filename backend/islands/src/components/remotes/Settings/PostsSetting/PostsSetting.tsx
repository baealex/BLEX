import { useState, useEffect, useRef } from 'react';
import { http, type Response } from '~/modules/http.module';
import { notification } from '@baejino/ui';
import { useFetch } from '~/hooks/use-fetch';
import { Button, Input } from '~/components/shared';

interface Post {
    url: string;
    title: string;
    createdDate: string;
    updatedDate: string;
    isHide: boolean;
    countLikes: number;
    countComments: number;
    todayCount: number;
    yesterdayCount: number;
    readTime: number;
    tag: string;
    series: string;
    hasTagChanged?: boolean;
    hasSeriesChanged?: boolean;
}

interface PostsData {
    username: string;
    posts: Post[];
    lastPage: number;
}

interface Tag {
    name: string;
    count: number;
}

interface Series {
    url: string;
    title: string;
    totalPosts: number;
}

interface FilterOptions {
    search: string;
    tag: string;
    series: string;
    order: string;
    page: string;
    status: string;
}

const POSTS_ORDER = [
    {
        name: '최신순',
        order: '-created_date'
    },
    {
        name: '오래된순',
        order: 'created_date'
    },
    {
        name: '제목순',
        order: 'title'
    },
    {
        name: '제목 역순',
        order: '-title'
    },
    {
        name: '수정일순',
        order: '-updated_date'
    },
    {
        name: '좋아요 많은순',
        order: '-count_likes'
    },
    {
        name: '댓글 많은순',
        order: '-count_comments'
    },
    {
        name: '분량 많은순',
        order: '-read_time'
    },
    {
        name: '공개 글 우선',
        order: 'hide'
    },
    {
        name: '비공개 글 우선',
        order: '-hide'
    }
];

const PostsSetting = () => {
    const [filters, setFilters] = useState<FilterOptions>({
        search: '',
        tag: '',
        series: '',
        order: '-created_date',
        page: '1',
        status: ''
    });

    const [posts, setPosts] = useState<Post[]>([]);
    const [postsMounted, setPostsMounted] = useState(false);
    const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { data: postsData, isLoading, isError, refetch } = useFetch({
        queryKey: ['posts-setting', JSON.stringify(filters)],
        queryFn: async () => {
            setPostsMounted(false);

            const params = new URLSearchParams();
            Object.entries(filters).forEach(([key, value]) => {
                if (value) params.append(key, value);
            });

            const { data } = await http<Response<PostsData>>(`v1/setting/posts?${params.toString()}`, { method: 'GET' });

            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error('포스트 목록을 불러오는데 실패했습니다.');
        }
    });

    const { data: tags } = useFetch({
        queryKey: ['setting-tags'],
        queryFn: async () => {
            const { data } = await http<Response<{ tags: Tag[] }>>('v1/setting/tag', { method: 'GET' });
            if (data.status === 'DONE') {
                return data.body.tags;
            }
            throw new Error('태그 목록을 불러오는데 실패했습니다.');
        }
    });

    const { data: series } = useFetch({
        queryKey: ['setting-series'],
        queryFn: async () => {
            const { data } = await http<Response<{ series: Series[] }>>('v1/setting/series', { method: 'GET' });
            if (data.status === 'DONE') {
                return data.body.series;
            }
            throw new Error('시리즈 목록을 불러오는데 실패했습니다.');
        }
    });

    useEffect(() => {
        if (postsData) {
            setPostsMounted(true);
            setPosts(postsData.posts.map(post => ({
                ...post,
                hasTagChanged: false,
                hasSeriesChanged: false
            })));
        }
    }, [postsData]);

    useEffect(() => {
        if (isError) {
            notification('포스트 목록을 불러오는데 실패했습니다.', { type: 'error' });
        }
    }, [isError]);

    const handleFilterChange = (key: keyof FilterOptions, value: string) => {
        setFilters(prev => ({
            ...prev,
            [key]: value,
            page: key !== 'page' ? '1' : value
        }));
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;

        if (searchDebounce.current) {
            clearTimeout(searchDebounce.current);
        }

        searchDebounce.current = setTimeout(() => {
            handleFilterChange('search', value);
        }, 300);
    };

    const handlePostVisibilityToggle = async (postUrl: string) => {
        try {
            const { data } = await http(`v1/users/@${postsData?.username}/posts/${postUrl}?hide=hide`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                data: ''
            });

            if (data.status === 'DONE') {
                setPosts(prev => prev.map(post =>
                    post.url === postUrl
                        ? {
                            ...post,
                            isHide: data.body.isHide
                        }
                        : post
                ));
                notification(`포스트가 ${data.body.isHide ? '비공개' : '공개'}로 변경되었습니다.`, { type: 'success' });
            } else {
                throw new Error('Failed to toggle visibility');
            }
        } catch {
            notification('포스트 공개 설정 변경에 실패했습니다.', { type: 'error' });
        }
    };

    const handlePostDelete = async (postUrl: string) => {
        if (!confirm('정말 이 포스트를 삭제할까요?')) return;

        try {
            const { data } = await http(`v1/users/@${postsData?.username}/posts/${postUrl}`, { method: 'DELETE' });

            if (data.status === 'DONE') {
                notification('포스트가 삭제되었습니다.', { type: 'success' });
                refetch();
            } else {
                throw new Error('Failed to delete post');
            }
        } catch {
            notification('포스트 삭제에 실패했습니다.', { type: 'error' });
        }
    };

    const handleTagChange = (postUrl: string, value: string) => {
        setPosts(prev => prev.map(post =>
            post.url === postUrl
                ? {
                    ...post,
                    tag: value,
                    hasTagChanged: post.tag !== value
                }
                : post
        ));
    };

    const handleTagSubmit = async (postUrl: string) => {
        const post = posts.find(p => p.url === postUrl);
        if (!post) return;

        try {
            const formData = `tag=${encodeURIComponent(post.tag)}`;

            const { data } = await http(`v1/users/@${postsData?.username}/posts/${postUrl}?tag=tag`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                data: formData
            });

            if (data.status === 'DONE') {
                setPosts(prev => prev.map(p =>
                    p.url === postUrl
                        ? {
                            ...p,
                            tag: data.body.tag || '',
                            hasTagChanged: false
                        }
                        : p
                ));
                notification('태그가 수정되었습니다.', { type: 'success' });
            } else {
                throw new Error('Failed to update tag');
            }
        } catch {
            notification('태그 수정에 실패했습니다.', { type: 'error' });
        }
    };

    const handleSeriesChange = (postUrl: string, value: string) => {
        setPosts(prev => prev.map(post =>
            post.url === postUrl
                ? {
                    ...post,
                    series: value,
                    hasSeriesChanged: post.series !== value
                }
                : post
        ));
    };

    const handleSeriesSubmit = async (postUrl: string) => {
        const post = posts.find(p => p.url === postUrl);
        if (!post) return;

        try {
            const formData = `series=${encodeURIComponent(post.series)}`;

            const { data } = await http(`v1/users/@${postsData?.username}/posts/${postUrl}?series=series`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                data: formData
            });

            if (data.status === 'DONE') {
                setPosts(prev => prev.map(p =>
                    p.url === postUrl
                        ? {
                            ...p,
                            series: data.body.series || '',
                            hasSeriesChanged: false
                        }
                        : p
                ));
                notification('시리즈가 수정되었습니다.', { type: 'success' });
            } else {
                throw new Error('Failed to update series');
            }
        } catch {
            notification('시리즈 수정에 실패했습니다.', { type: 'error' });
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ko-KR');
    };

    return (
        <div className="p-6 bg-white shadow-sm rounded-2xl border border-gray-200">
            {/* 헤더 섹션 */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">포스트 ({posts.length})</h2>
                        <p className="text-gray-600">포스트를 관리하고 태그, 시리즈를 편집하세요.</p>
                    </div>
                    <Button
                        variant="primary"
                        size="md"
                        leftIcon={<i className="fas fa-plus" />}
                        onClick={() => window.location.href = '/write'}
                        className="hidden sm:inline-flex">
                        새 포스트 작성
                    </Button>
                </div>

                {/* Mobile button */}
                <div className="sm:hidden">
                    <Button
                        variant="primary"
                        size="md"
                        fullWidth
                        leftIcon={<i className="fas fa-plus" />}
                        onClick={() => window.location.href = '/write'}>
                        새 포스트 작성
                    </Button>
                </div>
            </div>

            {/* 필터 및 검색 섹션 */}
            <div className="mb-6 p-6 bg-gray-50 border border-gray-200 rounded-2xl">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <i className="fas fa-filter mr-3" />
                    필터 및 검색
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <Input
                        type="text"
                        placeholder="포스트 제목 검색..."
                        defaultValue={filters.search}
                        onChange={handleSearchChange}
                        leftIcon={<i className="fas fa-search" />}
                    />

                    <div className="relative">
                        <select
                            value={filters.tag}
                            onChange={(e) => handleFilterChange('tag', e.target.value)}
                            className="block w-full px-4 py-3 border border-gray-200 rounded-xl bg-white focus:border-gray-500 focus:ring-2 focus:ring-gray-500 text-sm">
                            <option value="">태그 선택</option>
                            {tags?.map((tag, index) => (
                                <option key={index} value={tag.name}>
                                    {tag.name} ({tag.count})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="relative">
                        <select
                            value={filters.series}
                            onChange={(e) => handleFilterChange('series', e.target.value)}
                            className="block w-full px-4 py-3 border border-gray-200 rounded-xl bg-white focus:border-gray-500 focus:ring-2 focus:ring-gray-500 text-sm">
                            <option value="">시리즈 선택</option>
                            {series?.map((item, index) => (
                                <option key={index} value={item.url}>
                                    {item.title} ({item.totalPosts})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="relative">
                        <select
                            value={filters.order}
                            onChange={(e) => handleFilterChange('order', e.target.value)}
                            className="block w-full px-4 py-3 border border-gray-200 rounded-xl bg-white focus:border-gray-500 focus:ring-2 focus:ring-gray-500 text-sm">
                            {POSTS_ORDER.map((order, index) => (
                                <option key={index} value={order.order}>
                                    {order.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* 포스트 리스트 */}
            {postsMounted && posts.length === 0 ? (
                <div className="text-center py-16">
                    <div className="w-20 h-20 mx-auto bg-gray-100 rounded-2xl flex items-center justify-center mb-6">
                        <i className="fas fa-file-alt text-gray-400 text-3xl" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">포스트가 없습니다</h3>
                    <p className="text-gray-500 mb-6">첫 번째 포스트를 작성해보세요!</p>
                    <Button
                        variant="primary"
                        size="md"
                        leftIcon={<i className="fas fa-plus" />}
                        onClick={() => window.location.href = '/write'}>
                        첫 포스트 작성하기
                    </Button>
                </div>
            ) : (
                <div className="space-y-3">
                    {posts.map((post) => (
                        <div key={post.url} className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md transition-all duration-300">
                            {/* 헤더 */}
                            <div className="p-4 border-b border-gray-200">
                                <div className="flex items-start justify-between gap-4 mb-3">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-base font-bold text-gray-900 mb-1.5 truncate">
                                            <a
                                                href={`/@${postsData?.username}/${post.url}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="hover:text-black transition-colors">
                                                {post.title}
                                            </a>
                                        </h3>
                                        <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                                            <span className="flex items-center">
                                                <i className="fas fa-calendar mr-1.5" />
                                                {formatDate(post.createdDate)}
                                            </span>
                                            {post.createdDate !== post.updatedDate && (
                                                <span className="flex items-center">
                                                    <i className="fas fa-edit mr-1.5" />
                                                    수정됨
                                                </span>
                                            )}
                                            {post.isHide && (
                                                <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs flex items-center font-medium">
                                                    <i className="fas fa-lock mr-1" />
                                                    비공개
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="secondary"
                                            size="md"
                                            onClick={() => handlePostVisibilityToggle(post.url)}
                                            title={post.isHide ? '공개로 변경' : '비공개로 변경'}>
                                            <i className={`fas ${post.isHide ? 'fa-eye' : 'fa-eye-slash'}`} />
                                        </Button>

                                        <Button
                                            variant="secondary"
                                            size="md"
                                            onClick={() => window.location.href = `/@${postsData?.username}/${post.url}/edit`}
                                            title="포스트 수정">
                                            <i className="fas fa-edit" />
                                        </Button>

                                        <Button
                                            variant="secondary"
                                            size="md"
                                            onClick={() => handlePostDelete(post.url)}
                                            title="포스트 삭제">
                                            <i className="fas fa-trash" />
                                        </Button>
                                    </div>
                                </div>

                                {/* 통계 */}
                                <div className="flex items-center gap-4 text-sm">
                                    <span className="flex items-center text-gray-700">
                                        <i className="fas fa-heart text-red-500 mr-1.5" />
                                        <span className="font-semibold">{post.countLikes}</span>
                                    </span>
                                    <span className="flex items-center text-gray-700">
                                        <i className="fas fa-comment text-blue-500 mr-1.5" />
                                        <span className="font-semibold">{post.countComments}</span>
                                    </span>
                                    <span className="flex items-center text-gray-700">
                                        <i className="fas fa-clock text-gray-500 mr-1.5" />
                                        <span className="font-semibold">{post.readTime}분</span>
                                    </span>
                                </div>
                            </div>

                            {/* 편집 영역 */}
                            <div className="p-4 space-y-3">
                                {/* 태그 */}
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white flex-shrink-0">
                                        <i className="fas fa-tag text-xs" />
                                    </div>
                                    <Input
                                        type="text"
                                        placeholder="태그를 입력하세요..."
                                        value={post.tag}
                                        onChange={(e) => handleTagChange(post.url, e.target.value)}
                                        className="flex-1"
                                    />
                                    {post.hasTagChanged && (
                                        <Button
                                            variant="primary"
                                            size="md"
                                            leftIcon={<i className="fas fa-save" />}
                                            onClick={() => handleTagSubmit(post.url)}>
                                            저장
                                        </Button>
                                    )}
                                </div>

                                {/* 시리즈 */}
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white flex-shrink-0">
                                        <i className="fas fa-book text-xs" />
                                    </div>
                                    <select
                                        value={post.series}
                                        onChange={(e) => handleSeriesChange(post.url, e.target.value)}
                                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-gray-500 focus:ring-2 focus:ring-gray-500 bg-white">
                                        <option value="">시리즈 선택 안함</option>
                                        {series?.map((item, index) => (
                                            <option key={index} value={item.url}>
                                                {item.title}
                                            </option>
                                        ))}
                                    </select>
                                    {post.hasSeriesChanged && (
                                        <Button
                                            variant="primary"
                                            size="md"
                                            leftIcon={<i className="fas fa-save" />}
                                            onClick={() => handleSeriesSubmit(post.url)}>
                                            저장
                                        </Button>
                                    )}
                                </div>

                                {post.readTime > 30 && (
                                    <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-xl p-4">
                                        <div className="flex items-start">
                                            <i className="fas fa-exclamation-triangle text-yellow-600 mr-3 mt-0.5" />
                                            <div>
                                                <h4 className="text-sm font-semibold text-gray-900 mb-1">긴 글 주의</h4>
                                                <p className="text-sm text-gray-600">
                                                    이 글은 읽는데 {post.readTime}분이 걸립니다.
                                                    내용을 나누어 여러 포스트로 작성하는 것을 고려해보세요.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 페이지네이션 */}
            {postsData && postsData.lastPage > 1 && (
                <div className="flex justify-center items-center gap-3 mt-6">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleFilterChange('page', String(Math.max(1, parseInt(filters.page) - 1)))}
                        disabled={filters.page === '1'}
                        leftIcon={<i className="fas fa-chevron-left" />}>
                        이전
                    </Button>
                    <div className="px-4 py-2 text-sm text-gray-700 font-medium">
                        {filters.page} / {postsData.lastPage}
                    </div>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleFilterChange('page', String(Math.min(postsData.lastPage, parseInt(filters.page) + 1)))}
                        disabled={filters.page === String(postsData.lastPage)}
                        rightIcon={<i className="fas fa-chevron-right" />}>
                        다음
                    </Button>
                </div>
            )}
        </div>
    );
};

export default PostsSetting;
