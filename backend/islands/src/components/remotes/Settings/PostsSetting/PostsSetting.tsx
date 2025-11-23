import { useState, useEffect, useRef } from 'react';
import { toast } from '~/utils/toast';
import { useQuery } from '@tanstack/react-query';
import { Button, Input, Dropdown, Alert } from '~/components/shared';
import { getIconClass } from '~/components/shared/settingsStyles';
import { useConfirm } from '~/contexts/ConfirmContext';
import {
    getPosts,
    togglePostVisibility,
    deletePost,
    updatePostTags,
    updatePostSeries,
    type Post as ApiPost
} from '~/lib/api/posts';
import { getTags, getSeries, type Tag, type Series } from '~/lib/api/settings';

interface Post extends ApiPost {
    hasTagChanged?: boolean;
    hasSeriesChanged?: boolean;
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
    const { confirm } = useConfirm();
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

    const { data: postsData, isLoading, isError, refetch } = useQuery({
        queryKey: ['posts-setting', JSON.stringify(filters)],
        queryFn: async () => {
            setPostsMounted(false);

            // Map filters to API format (order -> sort)
            const apiFilters: Record<string, string | number> = {};
            Object.entries(filters).forEach(([key, value]) => {
                if (value) {
                    if (key === 'order') {
                        apiFilters['sort'] = value;
                    } else {
                        apiFilters[key] = value;
                    }
                }
            });

            const { data } = await getPosts(apiFilters);

            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error('포스트 목록을 불러오는데 실패했습니다.');
        }
    });

    const { data: tags } = useQuery({
        queryKey: ['setting-tags'],
        queryFn: async () => {
            const { data } = await getTags();
            if (data.status === 'DONE') {
                return data.body.tags;
            }
            throw new Error('태그 목록을 불러오는데 실패했습니다.');
        }
    });

    const { data: series } = useQuery({
        queryKey: ['setting-series'],
        queryFn: async () => {
            const { data } = await getSeries();
            if (data.status === 'DONE') {
                return data.body.series;
            }
            throw new Error('시리즈 목록을 불러오는데 실패했습니다.');
        }
    });

    useEffect(() => {
        if (postsData) {
            setPostsMounted(true);
            setPosts(postsData.posts.map((post) => ({
                ...post,
                hasTagChanged: false,
                hasSeriesChanged: false
            })));
        }
    }, [postsData]);

    useEffect(() => {
        if (isError) {
            toast.error('포스트 목록을 불러오는데 실패했습니다.');
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
            const { data } = await togglePostVisibility(postsData!.username, postUrl);

            if (data.status === 'DONE') {
                setPosts(prev => prev.map(post =>
                    post.url === postUrl
                        ? {
                            ...post,
                            isHide: data.body.isHide
                        }
                        : post
                ));
                toast.success(`포스트가 ${data.body.isHide ? '비공개' : '공개'}로 변경되었습니다.`);
            } else {
                throw new Error('Failed to toggle visibility');
            }
        } catch {
            toast.error('포스트 공개 설정 변경에 실패했습니다.');
        }
    };

    const handlePostDelete = async (postUrl: string) => {
        const confirmed = await confirm({
            title: '포스트 삭제',
            message: '정말 이 포스트를 삭제할까요?',
            confirmText: '삭제',
            variant: 'danger'
        });

        if (!confirmed) return;

        try {
            const { data } = await deletePost(postsData!.username, postUrl);

            if (data.status === 'DONE') {
                toast.success('포스트가 삭제되었습니다.');
                refetch();
            } else {
                throw new Error('Failed to delete post');
            }
        } catch {
            toast.error('포스트 삭제에 실패했습니다.');
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
            const { data } = await updatePostTags(postsData!.username, postUrl, post.tag);

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
                toast.success('태그가 수정되었습니다.');
            } else {
                throw new Error('Failed to update tag');
            }
        } catch {
            toast.error('태그 수정에 실패했습니다.');
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
            const { data } = await updatePostSeries(postsData!.username, postUrl, post.series || '');

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
                toast.success('시리즈가 수정되었습니다.');
            } else {
                throw new Error('Failed to update series');
            }
        } catch {
            toast.error('시리즈 수정에 실패했습니다.');
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ko-KR');
    };

    if (isLoading) {
        return null;
    }

    return (
        <div className="p-6 bg-white shadow-sm rounded-2xl border border-gray-200">
            {/* 헤더 섹션 */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">포스트</h2>
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
                            {tags?.map((tag: Tag, index: number) => (
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
                            {series?.map((item: Series, index: number) => (
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
                        <div key={post.url} className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-200 overflow-hidden">
                            {/* 헤더 */}
                            <div
                                className="p-5 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors"
                                onClick={() => window.location.href = `/@${postsData?.username}/${post.url}/edit`}>
                                <div className="flex items-start justify-between gap-4 mb-3">
                                    {/* 제목 영역 */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg font-bold text-gray-900 mb-2 break-words leading-tight">
                                            {post.title}
                                        </h3>
                                        <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap">
                                            <span className="flex items-center">
                                                <i className="fas fa-calendar mr-1.5" />
                                                {formatDate(post.createdDate)}
                                            </span>
                                            {post.createdDate !== post.updatedDate && (
                                                <span className="text-gray-400">•</span>
                                            )}
                                            {post.createdDate !== post.updatedDate && (
                                                <span>수정됨</span>
                                            )}
                                            <span className="text-gray-400">•</span>
                                            <span className="flex items-center gap-3">
                                                <span className="flex items-center">
                                                    <i className="fas fa-heart text-red-400 mr-1" />
                                                    {post.countLikes}
                                                </span>
                                                <span className="flex items-center">
                                                    <i className="fas fa-comment text-blue-400 mr-1" />
                                                    {post.countComments}
                                                </span>
                                                <span className="flex items-center">
                                                    <i className="fas fa-clock text-gray-400 mr-1" />
                                                    {post.readTime}분
                                                </span>
                                            </span>
                                            {post.isHide && (
                                                <>
                                                    <span className="text-gray-400">•</span>
                                                    <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                                                        <i className="fas fa-lock mr-1.5" />
                                                        비공개
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* 액션 */}
                                    <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                        <Dropdown
                                            items={[
                                                {
                                                    label: '포스트 보기',
                                                    icon: 'fas fa-eye',
                                                    onClick: () => location.assign(`/@${postsData?.username}/${post.url}`)
                                                },
                                                {
                                                    label: post.isHide ? '공개로 변경' : '비공개로 변경',
                                                    icon: `fas ${post.isHide ? 'fa-eye' : 'fa-eye-slash'}`,
                                                    onClick: () => handlePostVisibilityToggle(post.url)
                                                },
                                                {
                                                    label: '삭제',
                                                    icon: 'fas fa-trash',
                                                    onClick: () => handlePostDelete(post.url),
                                                    variant: 'danger'
                                                }
                                            ]}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 편집 영역 */}
                            <div className="p-3 space-y-3 bg-gray-50">
                                {/* 태그 */}
                                <div className="flex items-center gap-3">
                                    <div className={getIconClass('light')}>
                                        <i className="fas fa-tag text-sm" />
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
                                <div className="flex items-center gap-3">
                                    <div className={getIconClass('light')}>
                                        <i className="fas fa-book text-sm" />
                                    </div>
                                    <select
                                        value={post.series || ''}
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
                                    <Alert variant="warning" title="긴 글 주의">
                                        이 글은 읽는데 {post.readTime}분이 걸립니다.
                                        내용을 나누어 여러 포스트로 작성하는 것을 고려해보세요.
                                    </Alert>
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
