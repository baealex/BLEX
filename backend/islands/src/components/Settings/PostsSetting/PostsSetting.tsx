import { useState, useEffect, useRef } from 'react';
import { settingsApi } from '~/api/settings';
import { http, type Response } from '~/modules/http.module';
import { notification } from '@baejino/ui';
import { useFetch } from '~/hooks/use-fetch';

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
        name: '오늘 조회수 높은순',
        order: '-today_count'
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

            const data = await settingsApi.getPosts();
            return data;
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
            const data = await settingsApi.getSeries();
            return data.series;
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
        <div className="p-4 sm:p-6 bg-white shadow-sm border border-slate-200/60 rounded-xl">
            {/* 헤더 섹션 */}
            <div className="mb-6">
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200/60 rounded-xl p-4 sm:p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg sm:text-xl font-bold text-indigo-900 mb-2 flex items-center">
                                <i className="fas fa-file-alt mr-3 text-indigo-700" />
                                내 포스트 관리 ({posts.length})
                            </h2>
                            <p className="text-indigo-700 text-sm">포스트를 관리하고 태그, 시리즈를 편집하세요.</p>
                        </div>
                        <a
                            href="/write"
                            className="hidden sm:inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200">
                            <i className="fas fa-plus mr-2" />
                            새 포스트 작성
                        </a>
                    </div>
                    <div className="sm:hidden mt-4">
                        <a
                            href="/write"
                            className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200">
                            <i className="fas fa-plus mr-2" />
                            새 포스트 작성
                        </a>
                    </div>
                </div>
            </div>

            {/* 필터 및 검색 섹션 */}
            <div className="mb-6">
                <div className="bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200/60 rounded-xl p-4 sm:p-6">
                    <div className="mb-4">
                        <h3 className="text-lg font-semibold text-slate-900 mb-2 flex items-center">
                            <i className="fas fa-filter mr-3 text-slate-700" />
                            필터 및 검색
                        </h3>
                        <p className="text-slate-600 text-sm">포스트를 검색하고 필터링하세요.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <i className="fas fa-search text-slate-400 text-sm" />
                            </div>
                            <input
                                type="text"
                                placeholder="포스트 제목 검색..."
                                defaultValue={filters.search}
                                onChange={handleSearchChange}
                                className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-lg bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/50 focus:ring-offset-0 text-sm transition-all duration-200"
                            />
                        </div>

                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <i className="fas fa-tag text-slate-400 text-sm" />
                            </div>
                            <select
                                value={filters.tag}
                                onChange={(e) => handleFilterChange('tag', e.target.value)}
                                className="block w-full pl-10 pr-8 py-3 border border-slate-200 rounded-lg bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/50 focus:ring-offset-0 text-sm transition-all duration-200 appearance-none">
                                <option value="">태그 선택</option>
                                {tags?.map((tag, index) => (
                                    <option key={index} value={tag.name}>
                                        {tag.name} ({tag.count})
                                    </option>
                                ))}
                            </select>
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <i className="fas fa-chevron-down text-slate-400 text-sm" />
                            </div>
                        </div>

                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <i className="fas fa-book text-slate-400 text-sm" />
                            </div>
                            <select
                                value={filters.series}
                                onChange={(e) => handleFilterChange('series', e.target.value)}
                                className="block w-full pl-10 pr-8 py-3 border border-slate-200 rounded-lg bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/50 focus:ring-offset-0 text-sm transition-all duration-200 appearance-none">
                                <option value="">시리즈 선택</option>
                                {series?.map((item, index) => (
                                    <option key={index} value={item.url}>
                                        {item.title} ({item.totalPosts})
                                    </option>
                                ))}
                            </select>
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <i className="fas fa-chevron-down text-slate-400 text-sm" />
                            </div>
                        </div>

                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <i className="fas fa-sort text-slate-400 text-sm" />
                            </div>
                            <select
                                value={filters.order}
                                onChange={(e) => handleFilterChange('order', e.target.value)}
                                className="block w-full pl-10 pr-8 py-3 border border-slate-200 rounded-lg bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/50 focus:ring-offset-0 text-sm transition-all duration-200 appearance-none">
                                {POSTS_ORDER.map((order, index) => (
                                    <option key={index} value={order.order}>
                                        {order.name}
                                    </option>
                                ))}
                            </select>
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <i className="fas fa-chevron-down text-slate-400 text-sm" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mb-6">
                {isLoading ? (
                    <div className="animate-pulse space-y-4">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="bg-white border border-slate-200/60 rounded-xl p-4 sm:p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex-1">
                                        <div className="h-6 bg-slate-200 rounded w-3/4 mb-3" />
                                        <div className="flex items-center space-x-4">
                                            <div className="h-4 bg-slate-200 rounded w-24" />
                                            <div className="h-4 bg-slate-200 rounded w-24" />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-10 h-10 bg-slate-200 rounded-lg" />
                                        <div className="w-10 h-10 bg-slate-200 rounded-lg" />
                                        <div className="w-10 h-10 bg-slate-200 rounded-lg" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : postsMounted && posts.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <i className="fas fa-file-alt text-slate-400 text-2xl" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 mb-2">포스트가 없습니다</h3>
                        <p className="text-slate-500 mb-4">첫 번째 포스트를 작성해보세요!</p>
                        <a
                            href="/write"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors duration-200 shadow-sm hover:shadow-md">
                            <i className="fas fa-plus text-sm" />
                            첫 포스트 작성하기
                        </a>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {posts.map((post) => (
                            <div key={post.url} className="mb-6">
                                <div className="bg-white border border-solid border-slate-200/60 rounded-2xl overflow-hidden">
                                    <div className="bg-slate-100 p-4 sm:p-6 text-slate-900">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="text-xl font-bold text-slate-900 truncate transition-colors">
                                                        <a
                                                            href={`/@${postsData?.username}/${post.url}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="hover:text-primary-600 transition-colors">
                                                            {post.title}
                                                        </a>
                                                    </h3>
                                                    <div className="flex items-center gap-4 mt-1 text-sm text-slate-600/80 flex-wrap">
                                                        <span className="flex items-center">
                                                            <i className="fas fa-calendar mr-1" />
                                                            {formatDate(post.createdDate)}
                                                        </span>
                                                        {post.createdDate !== post.updatedDate && (
                                                            <span className="flex items-center">
                                                                <i className="fas fa-edit mr-1" />
                                                                수정됨
                                                            </span>
                                                        )}
                                                        {post.isHide && (
                                                            <span className="bg-red-300/80 text-red-800 px-2 py-1 rounded-full text-xs flex items-center">
                                                                <i className="fas fa-lock mr-1" />
                                                                비공개
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 ml-4">
                                                <button
                                                    onClick={() => handlePostVisibilityToggle(post.url)}
                                                    className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl transition-all duration-200 backdrop-blur-sm bg-green-300/20 text-green-800 hover:bg-green-300/30"
                                                    title={post.isHide ? '공개로 변경' : '비공개로 변경'}>
                                                    <i className={`fas ${post.isHide ? 'fa-eye' : 'fa-eye-slash'} text-sm sm:text-lg`} />
                                                </button>

                                                <a
                                                    href={`/@${postsData?.username}/${post.url}/edit`}
                                                    className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-blue-400/20 text-blue-800 hover:bg-blue-400/30 rounded-xl transition-all duration-200 backdrop-blur-sm"
                                                    title="포스트 수정">
                                                    <i className="fas fa-edit text-sm sm:text-lg" />
                                                </a>

                                                <button
                                                    onClick={() => handlePostDelete(post.url)}
                                                    className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-red-400/20 text-red-800 hover:bg-red-400/30 rounded-xl transition-all duration-200 backdrop-blur-sm"
                                                    title="포스트 삭제">
                                                    <i className="fas fa-trash text-sm sm:text-lg" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 통계 영역 */}
                                    <div className="bg-slate-100 px-6 py-4 border-b border-slate-100">
                                        <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
                                            <div className="bg-white rounded-lg p-2 sm:p-3 shadow-sm border border-red-100/50 text-center">
                                                <div className="flex items-center justify-center text-red-500 mb-1">
                                                    <i className="fas fa-heart text-sm sm:text-lg" />
                                                </div>
                                                <div className="text-xs sm:text-sm font-semibold text-slate-700">{post.countLikes}</div>
                                                <div className="text-xs text-slate-500 hidden sm:block">좋아요</div>
                                            </div>
                                            <div className="bg-white rounded-lg p-2 sm:p-3 shadow-sm border border-blue-100/50 text-center">
                                                <div className="flex items-center justify-center text-blue-500 mb-1">
                                                    <i className="fas fa-comment text-sm sm:text-lg" />
                                                </div>
                                                <div className="text-xs sm:text-sm font-semibold text-slate-700">{post.countComments}</div>
                                                <div className="text-xs text-slate-500 hidden sm:block">댓글</div>
                                            </div>
                                            <div className="bg-white rounded-lg p-2 sm:p-3 shadow-sm border border-purple-100/50 text-center">
                                                <div className="flex items-center justify-center text-purple-500 mb-1">
                                                    <i className="fas fa-clock text-sm sm:text-lg" />
                                                </div>
                                                <div className="text-xs sm:text-sm font-semibold text-slate-700">{post.readTime}분</div>
                                                <div className="text-xs text-slate-500 hidden sm:block">분량</div>
                                            </div>
                                            <div className="bg-white rounded-lg p-2 sm:p-3 shadow-sm border border-green-100/50 text-center">
                                                <div className="flex items-center justify-center text-green-500 mb-1">
                                                    <i className="fas fa-eye text-sm sm:text-lg" />
                                                </div>
                                                <div className="text-xs sm:text-sm font-semibold text-slate-700">{post.todayCount}</div>
                                                <div className="text-xs text-slate-500 hidden sm:block">오늘 조회</div>
                                            </div>
                                            <div className="bg-white rounded-lg p-2 sm:p-3 shadow-sm border border-orange-100/50 text-center">
                                                <div className="flex items-center justify-center text-orange-500 mb-1">
                                                    <i className="fas fa-history text-sm sm:text-lg" />
                                                </div>
                                                <div className="text-xs sm:text-sm font-semibold text-slate-700">{post.yesterdayCount}</div>
                                                <div className="text-xs text-slate-500 hidden sm:block">어제 조회</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 편집 영역 */}
                                    <div className="p-4 sm:p-6 space-y-6">
                                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 sm:p-4 border border-blue-100/50">
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500 rounded-xl flex items-center justify-center text-white flex-shrink-0">
                                                    <i className="fas fa-tag text-sm sm:text-lg" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <label className="block text-sm font-medium text-blue-900 mb-2">태그 관리</label>
                                                    <input
                                                        type="text"
                                                        placeholder="태그를 입력하세요..."
                                                        value={post.tag}
                                                        onChange={(e) => handleTagChange(post.url, e.target.value)}
                                                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-blue-200 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200/50 focus:ring-offset-0 bg-white shadow-sm"
                                                    />
                                                </div>
                                                {post.hasTagChanged && (
                                                    <button
                                                        onClick={() => handleTagSubmit(post.url)}
                                                        className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg text-sm font-medium hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg">
                                                        <i className="fas fa-save mr-2" />저장
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-3 sm:p-4 border border-purple-100/50">
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-500 rounded-xl flex items-center justify-center text-white flex-shrink-0">
                                                    <i className="fas fa-book text-sm sm:text-lg" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <label className="block text-sm font-medium text-purple-900 mb-2">시리즈 관리</label>
                                                    <div className="relative">
                                                        <select
                                                            value={post.series}
                                                            onChange={(e) => handleSeriesChange(post.url, e.target.value)}
                                                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 pr-8 sm:pr-10 border border-purple-200 rounded-lg text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200/50 focus:ring-offset-0 appearance-none bg-white shadow-sm">
                                                            <option value="">시리즈 선택 안함</option>
                                                            {series?.map((item, index) => (
                                                                <option key={index} value={item.url}>
                                                                    {item.title}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <div className="absolute inset-y-0 right-0 pr-2 sm:pr-3 flex items-center pointer-events-none">
                                                            <i className="fas fa-chevron-down text-purple-400 text-sm" />
                                                        </div>
                                                    </div>
                                                </div>
                                                {post.hasSeriesChanged && (
                                                    <button
                                                        onClick={() => handleSeriesSubmit(post.url)}
                                                        className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg text-sm font-medium hover:from-purple-600 hover:to-pink-700 transition-all duration-200 shadow-md hover:shadow-lg">
                                                        <i className="fas fa-save mr-2" />저장
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {post.readTime > 30 && (
                                            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-400 rounded-lg p-4">
                                                <div className="flex items-start">
                                                    <div className="w-10 h-10 bg-yellow-400 rounded-lg flex items-center justify-center mr-3">
                                                        <i className="fas fa-exclamation-triangle text-white" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-medium text-yellow-800 mb-1">긴 글 주의</h4>
                                                        <p className="text-sm text-yellow-700">
                                                            이 글은 너무 길어서 독자 경험에 영향을 줄 수 있습니다.
                                                            내용을 나누어 여러 포스트로 작성하는 것을 고려해보세요.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* 페이지네이션 */}
                {postsData && postsData.lastPage > 1 && (
                    <div className="flex justify-center items-center gap-3 mt-6">
                        <button
                            onClick={() => handleFilterChange('page', String(Math.max(1, parseInt(filters.page) - 1)))}
                            disabled={filters.page === '1'}
                            className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                            <i className="fas fa-chevron-left mr-2" />
                            이전
                        </button>
                        <div className="px-4 py-2 text-sm text-slate-600">
                            <span className="font-medium text-indigo-600">{filters.page}</span>
                            <span className="mx-2">/</span>
                            <span className="font-medium">{postsData.lastPage}</span>
                        </div>
                        <button
                            onClick={() => handleFilterChange('page', String(Math.min(postsData.lastPage, parseInt(filters.page) + 1)))}
                            disabled={filters.page === String(postsData.lastPage)}
                            className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                            다음
                            <i className="fas fa-chevron-right ml-2" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PostsSetting;
