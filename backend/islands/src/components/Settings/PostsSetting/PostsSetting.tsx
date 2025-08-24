import { useState, useEffect, useRef } from 'react';
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
        name: '좋아요순',
        order: '-count_likes'
    },
    {
        name: '댓글순',
        order: '-count_comments'
    },
    {
        name: '오늘 조회수순',
        order: '-today_count'
    },
    {
        name: '읽기시간순',
        order: '-read_time'
    },
    {
        name: '공개 글만',
        order: 'hide'
    },
    {
        name: '비공개 글만',
        order: '-hide'
    }
];

const PostsSetting = () => {
    const [filters, setFilters] = useState<FilterOptions>({
        search: '',
        tag: '',
        series: '',
        order: '-created_date',
        page: '1'
    });

    const [posts, setPosts] = useState<Post[]>([]);
    const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { data: postsData, isLoading, isError, refetch } = useFetch({
        queryKey: ['posts-setting', JSON.stringify(filters)],
        queryFn: async () => {
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

    if (isLoading) {
        return (
            <div className="bg-white shadow-md rounded-lg">
                <div className="animate-pulse">
                    <div className="flex justify-between items-center mb-6">
                        <div className="h-6 bg-gray-200 rounded w-48" />
                        <div className="h-10 w-28 bg-gray-200 rounded-md" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-10 bg-gray-200 rounded" />
                        ))}
                    </div>
                    <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
                                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
                                <div className="h-4 bg-gray-200 rounded w-1/4" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div >
            {/* Beautiful Header */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div className="mb-4 sm:mb-0">
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                            내 포스트 관리
                        </h1>
                        <p className="text-gray-600 mt-2">
                            총 <span className="font-semibold text-blue-600">{posts.length}개</span>의 포스트
                        </p>
                    </div>
                    <a
                        href="/write"
                        className="group inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 font-medium">
                        <svg className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-200" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        새 포스트 작성
                    </a>
                </div>
            </div>

            {/* Beautiful Filters */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
                <div className="flex items-center mb-4">
                    <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full mr-3" />
                    <h2 className="text-lg font-semibold text-gray-800">필터 및 검색</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder="포스트 제목 검색..."
                            defaultValue={filters.search}
                            onChange={handleSearchChange}
                            className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm transition-all duration-200"
                        />
                    </div>

                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                        </div>
                        <select
                            value={filters.tag}
                            onChange={(e) => handleFilterChange('tag', e.target.value)}
                            className="block w-full pl-10 pr-8 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm transition-all duration-200 appearance-none">
                            <option value="">태그 선택</option>
                            {tags?.map((tag, index) => (
                                <option key={index} value={tag.name}>
                                    {tag.name} ({tag.count})
                                </option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                        </div>
                        <select
                            value={filters.series}
                            onChange={(e) => handleFilterChange('series', e.target.value)}
                            className="block w-full pl-10 pr-8 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm transition-all duration-200 appearance-none">
                            <option value="">시리즈 선택</option>
                            {series?.map((item, index) => (
                                <option key={index} value={item.url}>
                                    {item.title} ({item.totalPosts})
                                </option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                            </svg>
                        </div>
                        <select
                            value={filters.order}
                            onChange={(e) => handleFilterChange('order', e.target.value)}
                            className="block w-full pl-10 pr-8 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm transition-all duration-200 appearance-none">
                            {POSTS_ORDER.map((order, index) => (
                                <option key={index} value={order.order}>
                                    {order.name}
                                </option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Beautiful Posts List */}
            {posts.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                    <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                        <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">아직 포스트가 없어요</h3>
                    <p className="text-gray-600 mb-8">첫 번째 포스트를 작성해서 블로그를 시작해보세요!</p>
                    <a
                        href="/write"
                        className="group inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 font-medium">
                        <svg className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-200" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        첫 포스트 작성하기
                    </a>
                </div>
            ) : (
                <div className="space-y-6">
                    {posts.map((post) => (
                        <div
                            key={post.url}
                            className="bg-white rounded-2xl shadow-sm border border-gray-100 transition-all duration-300 overflow-hidden">

                            {/* Post Header */}
                            <div className="p-6 pb-0">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-3">
                                            <h3 className="text-xl font-bold text-gray-900 line-clamp-2">
                                                <a
                                                    href={`/@${postsData?.username}/${post.url}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="hover:text-transparent hover:bg-gradient-to-r hover:from-blue-600 hover:to-purple-600 hover:bg-clip-text transition-all duration-300">
                                                    {post.title}
                                                </a>
                                            </h3>
                                            {post.isHide && (
                                                <span className="inline-flex items-center px-3 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full border border-red-200">
                                                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                                    </svg>
                                                    비공개
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center text-sm text-gray-500 space-x-4 mb-4">
                                            <div className="flex items-center">
                                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                작성: {formatDate(post.createdDate)}
                                            </div>
                                            {post.createdDate !== post.updatedDate && (
                                                <div className="flex items-center">
                                                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                    수정: {formatDate(post.updatedDate)}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2 ml-6">
                                        <button
                                            onClick={() => handlePostVisibilityToggle(post.url)}
                                            className={`group p-3 rounded-xl transition-all duration-200 ${post.isHide
                                                ? 'bg-green-100 text-green-700 hover:bg-green-200 hover:shadow-md'
                                                : 'bg-red-100 text-red-700 hover:bg-red-200 hover:shadow-md'
                                                }`}
                                            title={post.isHide ? '공개로 변경' : '비공개로 변경'}>
                                            {post.isHide ? (
                                                <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            ) : (
                                                <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                                                </svg>
                                            )}
                                        </button>

                                        <a
                                            href={`/@${postsData?.username}/${post.url}/edit`}
                                            className="group p-3 bg-blue-100 text-blue-700 hover:bg-blue-200 hover:shadow-md rounded-xl transition-all duration-200"
                                            title="포스트 수정">
                                            <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </a>

                                        <button
                                            onClick={() => handlePostDelete(post.url)}
                                            className="group p-3 bg-red-100 text-red-700 hover:bg-red-200 hover:shadow-md rounded-xl transition-all duration-200"
                                            title="포스트 삭제">
                                            <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                {/* Beautiful Stats Bar */}
                                <div className="flex items-center justify-between bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 mb-4">
                                    <div className="flex items-center space-x-6">
                                        <div className="flex items-center text-pink-600">
                                            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                                            </svg>
                                            <span className="font-medium">{post.countLikes}</span>
                                        </div>
                                        <div className="flex items-center text-blue-600">
                                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                            </svg>
                                            <span className="font-medium">{post.countComments}</span>
                                        </div>
                                        <div className="flex items-center text-purple-600">
                                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <span className="font-medium">{post.readTime}분</span>
                                        </div>
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        <span className="font-medium text-green-600">오늘 {post.todayCount}</span>
                                        <span className="mx-2">·</span>
                                        <span className="font-medium text-orange-600">어제 {post.yesterdayCount}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Tag and Series Editing */}
                            <div className="px-6 pb-4 space-y-4">
                                {/* Tag Input */}
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center text-blue-600">
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                        </svg>
                                        <span className="font-medium text-sm">태그</span>
                                    </div>
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            placeholder="태그를 입력하세요..."
                                            value={post.tag}
                                            onChange={(e) => handleTagChange(post.url, e.target.value)}
                                            className="block w-full px-4 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm transition-all duration-200"
                                        />
                                    </div>
                                    {post.hasTagChanged && (
                                        <button
                                            onClick={() => handleTagSubmit(post.url)}
                                            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-medium text-sm hover:shadow-lg transform hover:scale-105 transition-all duration-200">
                                            저장
                                        </button>
                                    )}
                                </div>

                                {/* Series Select */}
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center text-purple-600">
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                        </svg>
                                        <span className="font-medium text-sm">시리즈</span>
                                    </div>
                                    <div className="flex-1 relative">
                                        <select
                                            value={post.series}
                                            onChange={(e) => handleSeriesChange(post.url, e.target.value)}
                                            className="block w-full px-4 py-2 pr-8 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-200 text-sm transition-all duration-200 appearance-none">
                                            <option value="">시리즈 선택 안함</option>
                                            {series?.map((item, index) => (
                                                <option key={index} value={item.url}>
                                                    {item.title}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>
                                    {post.hasSeriesChanged && (
                                        <button
                                            onClick={() => handleSeriesSubmit(post.url)}
                                            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl font-medium text-sm hover:shadow-lg transform hover:scale-105 transition-all duration-200">
                                            저장
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Warning for long posts */}
                            {post.readTime > 30 && (
                                <div className="mx-6 mb-6 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl">
                                    <div className="flex items-start">
                                        <div className="flex-shrink-0 mt-0.5">
                                            <svg className="h-5 w-5 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <div className="ml-3">
                                            <h4 className="text-sm font-medium text-yellow-800">긴 글 주의</h4>
                                            <p className="text-sm text-yellow-700 mt-1">
                                                이 글의 읽기 시간이 {post.readTime}분으로 길어서 검색 엔진 최적화와 독자 경험에 영향을 줄 수 있어요. 내용을 나누어 여러 포스트로 작성하는 것을 고려해보세요.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Beautiful Pagination */}
            {postsData && postsData.lastPage > 1 && (
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 mt-8">
                    <div className="flex justify-center items-center gap-2">
                        <button
                            onClick={() => handleFilterChange('page', String(Math.max(1, parseInt(filters.page) - 1)))}
                            disabled={filters.page === '1'}
                            className="px-6 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200">
                            <svg className="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            이전
                        </button>
                        <div className="px-6 py-3 text-sm">
                            <span className="font-medium text-blue-600">{filters.page}</span>
                            <span className="text-gray-500 mx-2">of</span>
                            <span className="font-medium text-gray-700">{postsData.lastPage}</span>
                        </div>
                        <button
                            onClick={() => handleFilterChange('page', String(Math.min(postsData.lastPage, parseInt(filters.page) + 1)))}
                            disabled={filters.page === String(postsData.lastPage)}
                            className="px-6 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200">
                            다음
                            <svg className="w-5 h-5 ml-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PostsSetting;
