import { useEffect, useState } from 'react';
import { Button, Input, Dropdown, Select } from '~/components/shared';
import { getIconClass } from '~/components/shared';
import type { Post } from '../hooks';
import type { Series } from '~/lib/api/settings';

interface PostCardProps {
    post: Post;
    username: string;
    series?: Series[];
    onVisibilityToggle: (postUrl: string) => void;
    onDelete: (postUrl: string) => void;
    onTagChange: (postUrl: string, value: string) => void;
    onTagSubmit: (postUrl: string) => void;
    onSeriesChange: (postUrl: string, value: string) => void;
    onSeriesSubmit: (postUrl: string) => void;
}

const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR');
};

const PostCard = ({
    post,
    username,
    series,
    onVisibilityToggle,
    onDelete,
    onTagChange,
    onTagSubmit,
    onSeriesChange,
    onSeriesSubmit
}: PostCardProps) => {
    const [isMetaEditorOpen, setIsMetaEditorOpen] = useState(false);
    const hasPendingChanges = !!post.hasTagChanged || !!post.hasSeriesChanged;

    const handleViewPost = () => {
        window.location.assign(`/@${username}/${post.url}`);
    };

    const handleEditPost = () => {
        window.location.assign(`/@${username}/${post.url}/edit`);
    };

    useEffect(() => {
        if (hasPendingChanges) {
            setIsMetaEditorOpen(true);
        }
    }, [hasPendingChanges]);

    return (
        <div className="bg-surface border border-line-light rounded-2xl hover:border-line transition-colors duration-200 overflow-hidden">
            {/* 헤더 */}
            <div
                className="p-4 border-b border-line-light cursor-pointer hover:bg-surface-subtle/50 transition-colors"
                onClick={handleViewPost}>
                <div className="flex items-start justify-between gap-4">
                    {/* 제목 영역 */}
                    <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-content leading-snug line-clamp-2">
                            {post.title}
                        </h3>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-content-secondary">
                            <span className="inline-flex items-center gap-1.5">
                                <i className="fas fa-calendar text-content-hint" />
                                {formatDate(post.createdDate)}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <i className="fas fa-clock text-content-hint" />
                                {post.readTime}분
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <i className="fas fa-heart text-content-hint" />
                                {post.countLikes}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <i className="fas fa-comment text-content-hint" />
                                {post.countComments}
                            </span>
                            {post.createdDate !== post.updatedDate && (
                                <span className="text-content-hint">최근 수정</span>
                            )}
                            {post.isHide && (
                                <span className="inline-flex items-center px-2 py-0.5 bg-surface-subtle text-content rounded-md font-medium">
                                    비공개
                                </span>
                            )}
                        </div>
                    </div>

                    {/* 액션 */}
                    <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Dropdown
                            items={[
                                {
                                    label: '포스트 편집',
                                    icon: 'fas fa-pen',
                                    onClick: handleEditPost
                                },
                                {
                                    label: post.isHide ? '공개로 변경' : '비공개로 변경',
                                    icon: `fas ${post.isHide ? 'fa-eye' : 'fa-eye-slash'}`,
                                    onClick: () => onVisibilityToggle(post.url)
                                },
                                {
                                    label: '삭제',
                                    icon: 'fas fa-trash',
                                    onClick: () => onDelete(post.url),
                                    variant: 'danger'
                                }
                            ]}
                        />
                    </div>
                </div>
            </div>

            <div className="px-4 py-2.5 bg-surface-subtle/40 border-t border-line-light flex justify-end">
                <button
                    type="button"
                    title="태그/시리즈 편집"
                    aria-label={isMetaEditorOpen ? '태그 및 시리즈 편집 닫기' : '태그 및 시리즈 편집 열기'}
                    onClick={() => setIsMetaEditorOpen(prev => !prev)}
                    className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-content-secondary hover:text-content hover:bg-surface-subtle transition-colors">
                    <i className="fas fa-sliders-h text-xs" />
                    <span className="inline-flex items-center gap-2">
                        {hasPendingChanges && (
                            <span className="text-[11px] px-2 py-0.5 rounded bg-action text-content-inverted">
                                저장 필요
                            </span>
                        )}
                        <i className={`fas ${isMetaEditorOpen ? 'fa-chevron-up' : 'fa-chevron-down'} text-xs`} />
                    </span>
                </button>
            </div>

            {isMetaEditorOpen && (
                <div className="p-4 pt-3 space-y-3 bg-surface-subtle/40 border-t border-line-light">
                    {/* 태그 */}
                    <div className="flex items-center gap-3">
                        <div className={getIconClass('light')}>
                            <i className="fas fa-tag text-sm" />
                        </div>
                        <Input
                            type="text"
                            placeholder="태그를 입력하세요..."
                            value={post.tag}
                            onChange={(e) => onTagChange(post.url, e.target.value)}
                            className="flex-1"
                        />
                        {post.hasTagChanged && (
                            <Button
                                variant="primary"
                                size="md"
                                leftIcon={<i className="fas fa-save" />}
                                onClick={() => onTagSubmit(post.url)}>
                                저장
                            </Button>
                        )}
                    </div>

                    {/* 시리즈 */}
                    <div className="flex items-center gap-3">
                        <div className={getIconClass('light')}>
                            <i className="fas fa-book text-sm" />
                        </div>
                        <div className="flex-1">
                            <Select
                                value={post.series || ''}
                                onValueChange={(value) => onSeriesChange(post.url, value)}
                                items={[
                                    {
                                        value: '',
                                        label: '시리즈 선택 안함'
                                    },
                                    ...(series?.map((item) => ({
                                        value: item.url,
                                        label: item.title
                                    })) || [])
                                ]}
                                placeholder="시리즈 선택 안함"
                            />
                        </div>
                        {post.hasSeriesChanged && (
                            <Button
                                variant="primary"
                                size="md"
                                leftIcon={<i className="fas fa-save" />}
                                onClick={() => onSeriesSubmit(post.url)}>
                                저장
                            </Button>
                        )}
                    </div>

                    {post.readTime > 30 && (
                        <Button
                            variant="secondary"
                            size="sm"
                            disabled
                            className="w-full justify-start text-content-secondary border-dashed">
                            긴 글 주의: 읽는데 {post.readTime}분이 걸립니다.
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
};

export default PostCard;
