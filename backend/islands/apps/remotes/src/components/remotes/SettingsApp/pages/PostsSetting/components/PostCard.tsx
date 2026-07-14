import { type ReactNode, useEffect, useState } from 'react';
import {
    BookOpen,
    Calendar,
    ChevronDown,
    ChevronUp,
    Clock,
    Eye,
    EyeOff,
    FileText,
    Heart,
    MessageCircle,
    Pencil,
    Save,
    SlidersHorizontal,
    Tag,
    Trash2
} from '@blex/ui/icons';
import { Button, Input, Dropdown, Select } from '~/components/shared';
import { getSettingsIconClass } from '~/styles/settingsStyles';
import { getMediaPath } from '~/modules/static.module';
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
    dateDisplay?: string;
    dateIcon?: ReactNode;
    dateIconClass?: string;
    statusLabel?: string;
    showUpdatedBadge?: boolean;
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
    onSeriesSubmit,
    dateDisplay,
    dateIcon,
    dateIconClass,
    statusLabel,
    showUpdatedBadge = true
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
                <div className="flex items-center justify-between gap-3 sm:gap-4">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-line-light bg-surface-subtle">
                            {post.image ? (
                                <img
                                    src={getMediaPath(post.image)}
                                    alt={post.title}
                                    loading="lazy"
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center text-content-hint">
                                    <FileText aria-hidden className="h-4 w-4" />
                                </div>
                            )}
                        </div>

                        {/* 제목 영역 */}
                        <div className="flex-1 min-w-0 py-0.5">
                            <h3 className="text-base font-semibold text-content leading-snug line-clamp-2">
                                {post.title}
                            </h3>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-content-secondary">
                                <span className="inline-flex items-center gap-1.5">
                                    {dateIcon ?? (
                                        dateIconClass
                                            ? <i aria-hidden className={`${dateIconClass} text-content-hint`} />
                                            : <Calendar aria-hidden className="h-3.5 w-3.5 text-content-hint" />
                                    )}
                                    {dateDisplay || formatDate(post.createdDate)}
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <Clock aria-hidden className="h-3.5 w-3.5 text-content-hint" />
                                    {post.readTime}분
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <Heart aria-hidden className="h-3.5 w-3.5 text-content-hint" />
                                    {post.countLikes}
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <MessageCircle aria-hidden className="h-3.5 w-3.5 text-content-hint" />
                                    {post.countComments}
                                </span>
                                {showUpdatedBadge && post.createdDate !== post.updatedDate && (
                                    <span className="text-content-hint">최근 수정</span>
                                )}
                                {statusLabel && (
                                    <span className="inline-flex items-center px-2 py-0.5 bg-surface-subtle text-content rounded-md font-medium">
                                        {statusLabel}
                                    </span>
                                )}
                                {post.isHide && (
                                    <span className="inline-flex items-center px-2 py-0.5 bg-surface-subtle text-content rounded-md font-medium">
                                        비공개
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 액션 */}
                    <div className="flex-shrink-0 self-center" onClick={(e) => e.stopPropagation()}>
                        <Dropdown
                            triggerAriaLabel={`${post.title} 포스트 메뉴 열기`}
                            triggerClassName="min-h-11 min-w-11"
                            items={[
                                {
                                    label: '포스트 편집',
                                    icon: <Pencil aria-hidden className="h-4 w-4" />,
                                    onClick: handleEditPost
                                },
                                {
                                    label: post.isHide ? '공개로 변경' : '비공개로 변경',
                                    icon: post.isHide
                                        ? <Eye aria-hidden className="h-4 w-4" />
                                        : <EyeOff aria-hidden className="h-4 w-4" />,
                                    onClick: () => onVisibilityToggle(post.url)
                                },
                                {
                                    label: '삭제',
                                    icon: <Trash2 aria-hidden className="h-4 w-4" />,
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
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2.5 py-1.5 text-content-secondary hover:text-content hover:bg-surface-subtle transition-colors">
                    <SlidersHorizontal aria-hidden className="h-3.5 w-3.5" />
                    <span className="inline-flex items-center gap-2">
                        {hasPendingChanges && (
                            <span className="text-[11px] px-2 py-0.5 rounded bg-action text-content-inverted">
                                저장 필요
                            </span>
                        )}
                        {isMetaEditorOpen
                            ? <ChevronUp aria-hidden className="h-3.5 w-3.5" />
                            : <ChevronDown aria-hidden className="h-3.5 w-3.5" />}
                    </span>
                </button>
            </div>

            {isMetaEditorOpen && (
                <div className="p-4 pt-3 space-y-3 bg-surface-subtle/40 border-t border-line-light">
                    {/* 태그 */}
                    <div className="flex items-center gap-3">
                        <div className={getSettingsIconClass('light')}>
                            <Tag aria-hidden className="h-4 w-4" />
                        </div>
                        <Input
                            type="text"
                            aria-label={`${post.title} 태그`}
                            placeholder="태그를 입력하세요..."
                            value={post.tag}
                            onChange={(e) => onTagChange(post.url, e.target.value)}
                            className="flex-1"
                        />
                        {post.hasTagChanged && (
                            <Button
                                variant="primary"
                                size="md"
                                className="min-h-11!"
                                leftIcon={<Save aria-hidden className="h-4 w-4" />}
                                onClick={() => onTagSubmit(post.url)}>
                                저장
                            </Button>
                        )}
                    </div>

                    {/* 시리즈 */}
                    <div className="flex items-center gap-3">
                        <div className={getSettingsIconClass('light')}>
                            <BookOpen aria-hidden className="h-4 w-4" />
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
                                className="min-h-11!"
                                leftIcon={<Save aria-hidden className="h-4 w-4" />}
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
                            긴 포스트 주의: 읽는데 {post.readTime}분이 걸립니다.
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
};

export default PostCard;
