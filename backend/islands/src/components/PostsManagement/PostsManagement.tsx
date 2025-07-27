import React, { useState, useEffect } from 'react';
import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';

interface Post {
    id: number;
    title: string;
    url: string;
    created: string;
    updated: string;
    visibility: 'public' | 'private' | 'unlisted';
    series?: {
        id: number;
        name: string;
    };
    tags: string[];
    viewCount: number;
    likeCount: number;
    commentCount: number;
}

interface PostsResponse {
    posts: Post[];
    hasNext: boolean;
    page: number;
    totalCount: number;
}

const PostsManagement: React.FC = () => {
    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [totalCount, setTotalCount] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'all' | 'public' | 'private' | 'unlisted'>('all');
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'popular'>('newest');

    useEffect(() => {
        fetchPosts();
    }, [page, filter, sortBy]);

    const fetchPosts = async (reset = false) => {
        if (reset) {
            setPage(1);
            setPosts([]);
        }

        setIsLoading(true);

        try {
            const params = new URLSearchParams({
                page: reset ? '1' : page.toString(),
                filter,
                sort: sortBy,
                search: searchTerm
            });

            const { data } = await http<{ status: string; body: PostsResponse }>(`v1/setting/posts?${params.toString()}`, {
                method: 'GET'
            });

            if (data.status === 'DONE') {
                if (reset || page === 1) {
                    setPosts(data.body.posts);
                } else {
                    setPosts(prev => [...prev, ...data.body.posts]);
                }
                setHasMore(data.body.hasNext);
                setTotalCount(data.body.totalCount);

                if (reset) {
                    setPage(1);
                }
            } else {
                notification('포스트를 불러오는데 실패했습니다.', { type: 'error' });
            }
        } catch (error) {
            notification('포스트를 불러오는데 실패했습니다.', { type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchPosts(true);
    };

    const handleLoadMore = () => {
        setPage(prev => prev + 1);
    };

    const handleDeletePost = async (id: number) => {
        if (!confirm('정말로 이 포스트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
            return;
        }

        try {
            const { data } = await http(`v1/posts/${id}`, {
                method: 'DELETE'
            });

            if (data.status === 'DONE') {
                setPosts(prev => prev.filter(post => post.id !== id));
                setTotalCount(prev => prev - 1);
                notification('포스트가 삭제되었습니다.', { type: 'success' });
            } else {
                notification('포스트 삭제에 실패했습니다.', { type: 'error' });
            }
        } catch (error) {
            notification('포스트 삭제에 실패했습니다.', { type: 'error' });
        }
    };

    const handleVisibilityChange = async (id: number, visibility: 'public' | 'private' | 'unlisted') => {
        try {
            const { data } = await http(`v1/posts/${id}/visibility`, {
                method: 'PUT',
                data: { visibility }
            });

            if (data.status === 'DONE') {
                setPosts(prev => prev.map(post =>
                    post.id === id ? { ...post, visibility } : post
                ));
                notification('포스트 공개 설정이 변경되었습니다.', { type: 'success' });
            } else {
                notification('포스트 공개 설정 변경에 실패했습니다.', { type: 'error' });
            }
        } catch (error) {
            notification('포스트 공개 설정 변경에 실패했습니다.', { type: 'error' });
        }
    };

    const getVisibilityLabel = (visibility: string) => {
        switch (visibility) {
            case 'public': return '공개';
            case 'private': return '비공개';
            case 'unlisted': return '링크 공개';
            default: return '알 수 없음';
        }
    };

    const getVisibilityIcon = (visibility: string) => {
        switch (visibility) {
            case 'public': return 'fas fa-globe';
            case 'private': return 'fas fa-lock';
            case 'unlisted': return 'fas fa-link';
            default: return 'fas fa-question';
        }
    };

    return (
        <div className="posts-management">
            <div className="posts-header">
                <h3 className="posts-title">내 포스트 ({totalCount})</h3>
                <a href="/write" className="btn btn-primary">
                    <i className="fas fa-plus"></i> 새 포스트
                </a>
            </div>

            <div className="posts-filters">
                <form onSubmit={handleSearch} className="search-form">
                    <input
                        type="text"
                        className="form-control"
                        placeholder="포스트 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button type="submit" className="btn btn-secondary">
                        <i className="fas fa-search"></i>
                    </button>
                </form>

                <div className="filter-controls">
                    <select
                        className="form-select"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as any)}
                    >
                        <option value="all">모든 포스트</option>
                        <option value="public">공개</option>
                        <option value="private">비공개</option>
                        <option value="unlisted">링크 공개</option>
                    </select>

                    <select
                        className="form-select"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                    >
                        <option value="newest">최신순</option>
                        <option value="oldest">오래된순</option>
                        <option value="popular">인기순</option>
                    </select>
                </div>
            </div>

            {isLoading && posts.length === 0 ? (
                <div className="loading-state">
                    <p>포스트를 불러오는 중...</p>
                </div>
            ) : posts.length === 0 ? (
                <div className="empty-state">
                    <p>포스트가 없습니다.</p>
                </div>
            ) : (
                <div className="posts-list">
                    {posts.map(post => (
                        <div key={post.id} className="post-item">
                            <div className="post-info">
                                <h4 className="post-title">
                                    <a href={`/${post.url}`} target="_blank" rel="noopener noreferrer">
                                        {post.title}
                                    </a>
                                </h4>
                                <div className="post-meta">
                                    <span className="post-date">
                                        <i className="far fa-calendar"></i> {post.created}
                                    </span>
                                    <span className="post-visibility">
                                        <i className={getVisibilityIcon(post.visibility)}></i> {getVisibilityLabel(post.visibility)}
                                    </span>
                                    {post.series && (
                                        <span className="post-series">
                                            <i className="fas fa-book"></i> {post.series.name}
                                        </span>
                                    )}
                                </div>
                                <div className="post-stats">
                                    <span className="stat-item">
                                        <i className="fas fa-eye"></i> {post.viewCount}
                                    </span>
                                    <span className="stat-item">
                                        <i className="fas fa-heart"></i> {post.likeCount}
                                    </span>
                                    <span className="stat-item">
                                        <i className="fas fa-comment"></i> {post.commentCount}
                                    </span>
                                </div>
                                {post.tags.length > 0 && (
                                    <div className="post-tags">
                                        {post.tags.map((tag, index) => (
                                            <span key={index} className="post-tag">{tag}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="post-actions">
                                <div className="visibility-dropdown">
                                    <button className="btn btn-icon dropdown-toggle">
                                        <i className={getVisibilityIcon(post.visibility)}></i>
                                    </button>
                                    <div className="dropdown-menu">
                                        <button
                                            className="dropdown-item"
                                            onClick={() => handleVisibilityChange(post.id, 'public')}
                                        >
                                            <i className="fas fa-globe"></i> 공개
                                        </button>
                                        <button
                                            className="dropdown-item"
                                            onClick={() => handleVisibilityChange(post.id, 'private')}
                                        >
                                            <i className="fas fa-lock"></i> 비공개
                                        </button>
                                        <button
                                            className="dropdown-item"
                                            onClick={() => handleVisibilityChange(post.id, 'unlisted')}
                                        >
                                            <i className="fas fa-link"></i> 링크 공개
                                        </button>
                                    </div>
                                </div>
                                <a
                                    href={`/edit/${post.url}`}
                                    className="btn btn-icon"
                                >
                                    <i className="fas fa-edit"></i>
                                </a>
                                <button
                                    className="btn btn-icon btn-danger"
                                    onClick={() => handleDeletePost(post.id)}
                                >
                                    <i className="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {hasMore && (
                <div className="load-more">
                    <button
                        className="btn btn-secondary btn-block"
                        onClick={handleLoadMore}
                        disabled={isLoading}
                    >
                        {isLoading ? '불러오는 중...' : '더 불러오기'}
                    </button>
                </div>
            )}

            <style jsx>{`
                .posts-management {
                    position: relative;
                }

                .posts-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }

                .posts-title {
                    margin: 0;
                    font-size: 18px;
                }

                .posts-filters {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    margin-bottom: 20px;
                }

                @media (min-width: 768px) {
                    .posts-filters {
                        flex-direction: row;
                        align-items: center;
                    }
                }

                .search-form {
                    display: flex;
                    gap: 8px;
                    flex: 1;
                }

                .search-form .form-control {
                    flex: 1;
                }

                .filter-controls {
                    display: flex;
                    gap: 8px;
                }

                .loading-state,
                .empty-state {
                    padding: 40px 0;
                    text-align: center;
                    color: #6c757d;
                }

                .posts-list {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    margin-bottom: 20px;
                }

                .post-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 16px;
                    background-color: #f8f9fa;
                    border-radius: 8px;
                }

                .post-info {
                    flex: 1;
                }

                .post-title {
                    margin: 0 0 8px 0;
                    font-size: 18px;
                }

                .post-title a {
                    color: #333;
                    text-decoration: none;
                }

                .post-title a:hover {
                    color: #4568dc;
                }

                .post-meta {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 12px;
                    margin-bottom: 8px;
                    font-size: 14px;
                    color: #6c757d;
                }

                .post-stats {
                    display: flex;
                    gap: 12px;
                    margin-bottom: 8px;
                    font-size: 14px;
                    color: #6c757d;
                }

                .post-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }

                .post-tag {
                    font-size: 12px;
                    padding: 2px 8px;
                    background-color: #e9ecef;
                    border-radius: 12px;
                    color: #495057;
                }

                .post-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .btn-icon {
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 4px;
                    background-color: #fff;
                    border: 1px solid #ced4da;
                    color: #495057;
                    cursor: pointer;
                    position: relative;
                }

                .btn-icon.btn-danger {
                    color: #dc3545;
                }

                .visibility-dropdown {
                    position: relative;
                }

                .dropdown-toggle::after {
                    display: none;
                }

                .dropdown-menu {
                    position: absolute;
                    right: 0;
                    top: 100%;
                    z-index: 10;
                    min-width: 120px;
                    background-color: #fff;
                    border: 1px solid #ced4da;
                    border-radius: 4px;
                    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
                    display: none;
                }

                .visibility-dropdown:hover .dropdown-menu {
                    display: block;
                }

                .dropdown-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 12px;
                    font-size: 14px;
                    background: none;
                    border: none;
                    width: 100%;
                    text-align: left;
                    cursor: pointer;
                }

                .dropdown-item:hover {
                    background-color: #f8f9fa;
                }

                .load-more {
                    margin-top: 20px;
                }
            `}</style>
        </div>
    );
};

export default PostsManagement;
