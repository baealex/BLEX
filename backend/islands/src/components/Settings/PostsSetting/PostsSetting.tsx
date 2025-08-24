import React, { useState, useEffect } from 'react';
import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

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
}

interface PostsResponse {
    username: string;
    posts: Post[];
    lastPage: number;
}

const searchSchema = z.object({
    search: z.string().optional(),
    tag: z.string().optional(),
    series: z.string().optional(),
    order: z.string().optional()
});

type SearchFormInputs = z.infer<typeof searchSchema>;

const PostsSetting: React.FC = () => {
    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [username, setUsername] = useState('');

    const { register, handleSubmit, watch } = useForm<SearchFormInputs>({
        resolver: zodResolver(searchSchema),
        defaultValues: {
            search: '',
            tag: '',
            series: '',
            order: '-created_date'
        }
    });

    const watchedValues = watch();

    useEffect(() => {
        fetchPosts(1, true);
    }, [watchedValues.tag, watchedValues.series, watchedValues.order]);

    const fetchPosts = async (page: number = 1, reset: boolean = false) => {
        if (reset) {
            setPosts([]);
            setCurrentPage(1);
        }

        setIsLoading(true);

        try {
            const params = {
                page: page.toString(),
                search: watchedValues.search || '',
                tag: watchedValues.tag || '',
                series: watchedValues.series || '',
                order: watchedValues.order || '-created_date'
            };

            const { data } = await http<{ status: string; body: PostsResponse }>('v1/setting/posts', {
                method: 'GET',
                params
            });

            if (data.status === 'DONE') {
                if (reset || page === 1) {
                    setPosts(data.body.posts);
                    setCurrentPage(1);
                } else {
                    setPosts(prev => [...prev, ...data.body.posts]);
                }
                setLastPage(data.body.lastPage);
                setUsername(data.body.username);
            } else {
                notification('포스트를 불러오는데 실패했습니다.', { type: 'error' });
            }
        } catch (error) {
            notification('포스트를 불러오는데 실패했습니다.', { type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const onSearch = () => {
        fetchPosts(1, true);
    };

    const handleLoadMore = () => {
        if (currentPage < lastPage) {
            const nextPage = currentPage + 1;
            setCurrentPage(nextPage);
            fetchPosts(nextPage, false);
        }
    };

    const handleVisibilityToggle = async (postUrl: string, currentVisibility: boolean) => {
        try {
            const { data } = await http(`posts/${postUrl}/visibility`, {
                method: 'PATCH',
                data: { hide: !currentVisibility }
            });

            if (data.status === 'DONE') {
                setPosts(prev => prev.map(post => 
                    post.url === postUrl ? { ...post, isHide: !currentVisibility } : post
                ));
                notification(`포스트가 ${!currentVisibility ? '비공개' : '공개'}로 변경되었습니다.`, { type: 'success' });
            } else {
                notification('포스트 공개 설정 변경에 실패했습니다.', { type: 'error' });
            }
        } catch (error) {
            notification('포스트 공개 설정 변경에 실패했습니다.', { type: 'error' });
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ko-KR');
    };


    return (
        <div className="p-6 bg-white shadow-md rounded-lg">
            <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-gray-900">내 포스트 관리</h2>
                    <a 
                        href="/write" 
                        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        새 포스트
                    </a>
                </div>

                <form onSubmit={handleSubmit(onSearch)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <input
                                type="text"
                                placeholder="포스트 제목 검색..."
                                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                {...register('search')}
                            />
                        </div>
                        <div>
                            <input
                                type="text"
                                placeholder="태그 필터..."
                                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                {...register('tag')}
                            />
                        </div>
                        <div>
                            <input
                                type="text"
                                placeholder="시리즈 필터..."
                                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                {...register('series')}
                            />
                        </div>
                        <div>
                            <select
                                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                {...register('order')}
                            >
                                <option value="-created_date">최신순</option>
                                <option value="created_date">오래된순</option>
                                <option value="-count_likes">좋아요 많은순</option>
                                <option value="-count_comments">댓글 많은순</option>
                                <option value="-today_count">오늘 조회수순</option>
                                <option value="title">제목순</option>
                            </select>
                        </div>
                    </div>
                    <button
                        type="submit"
                        className="w-full md:w-auto inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                    >
                        검색
                    </button>
                </form>
            </div>

            {isLoading && posts.length === 0 ? (
                <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="mt-2 text-sm text-gray-500">포스트를 불러오는 중...</p>
                </div>
            ) : posts.length === 0 ? (
                <div className="text-center py-12">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">포스트가 없습니다</h3>
                    <p className="mt-1 text-sm text-gray-500">첫 번째 포스트를 작성해보세요!</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {posts.map((post, index) => (
                        <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:shadow-sm transition-shadow">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="text-lg font-medium text-gray-900">
                                            <a 
                                                href={`/${username}/${post.url}`} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="hover:text-blue-600"
                                            >
                                                {post.title}
                                            </a>
                                        </h3>
                                        {post.isHide && (
                                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                                                비공개
                                            </span>
                                        )}
                                    </div>
                                    
                                    <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-2">
                                        <span>작성: {formatDate(post.createdDate)}</span>
                                        <span>수정: {formatDate(post.updatedDate)}</span>
                                        <span>읽기 시간: {post.readTime}분</span>
                                    </div>

                                    <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                                        <div className="flex items-center gap-1">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                            </svg>
                                            <span>{post.countLikes}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                            </svg>
                                            <span>{post.countComments}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                            <span>오늘 {post.todayCount}</span>
                                        </div>
                                    </div>

                                    {post.tag && (
                                        <div className="flex flex-wrap gap-1 mb-2">
                                            {post.tag.split(',').map((tag, tagIndex) => (
                                                <span 
                                                    key={tagIndex}
                                                    className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full"
                                                >
                                                    {tag.trim()}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {post.series && (
                                        <div className="text-sm text-gray-600 mb-2">
                                            <span className="font-medium">시리즈:</span> {post.series}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 ml-4">
                                    <button
                                        onClick={() => handleVisibilityToggle(post.url, post.isHide)}
                                        className={`p-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                            post.isHide 
                                                ? 'bg-green-100 text-green-800 hover:bg-green-200 focus:ring-green-500' 
                                                : 'bg-red-100 text-red-800 hover:bg-red-200 focus:ring-red-500'
                                        }`}
                                        title={post.isHide ? '공개로 변경' : '비공개로 변경'}
                                    >
                                        {post.isHide ? (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                        ) : (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                                            </svg>
                                        )}
                                    </button>
                                    <a
                                        href={`/write/${post.url}`}
                                        className="p-2 bg-blue-100 text-blue-800 hover:bg-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                        title="포스트 수정"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </a>
                                </div>
                            </div>
                        </div>
                    ))}

                    {currentPage < lastPage && (
                        <div className="text-center pt-6">
                            <button
                                onClick={handleLoadMore}
                                disabled={isLoading}
                                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                        불러오는 중...
                                    </>
                                ) : (
                                    <>더 불러오기 ({currentPage}/{lastPage})</>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PostsSetting;