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
import {
    Button,
    Input,
    Dropdown,
    Select
} from '~/components/shared';
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
    isTagSaving?: boolean;
    onSeriesChange: (postUrl: string, value: string) => void;
    onSeriesSubmit: (postUrl: string) => void;
    isSeriesSaving?: boolean;
    dateDisplay?: string;
    dateIcon?: ReactNode;
    dateIconClass?: string;
    statusLabel?: string;
    showUpdatedBadge?: boolean;
    isScheduled?: boolean;
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
    isTagSaving = false,
    onSeriesChange,
    onSeriesSubmit,
    isSeriesSaving = false,
    dateDisplay,
    dateIcon,
    dateIconClass,
    statusLabel,
    showUpdatedBadge = true,
    isScheduled = false
}: PostCardProps) => {
    const [isMetaEditorOpen, setIsMetaEditorOpen] = useState(false);
    const hasPendingChanges = !!post.hasTagChanged || !!post.hasSeriesChanged;
    const pendingChangeLabel = [
        post.hasTagChanged ? '태그' : '',
        post.hasSeriesChanged ? '시리즈' : ''
    ].filter(Boolean).join('·');
    const tagCount = post.tag
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean).length;
    const seriesTitle = series?.find(item => item.url === post.series)?.title;
    const classificationSummary = [
        tagCount > 0 ? `태그 ${tagCount}개` : '',
        seriesTitle || ''
    ].filter(Boolean).join(' · ');
    const visibilityTarget = post.isHide ? '공개' : '비공개';
    const visibilityActionLabel = `${isScheduled ? '발행 시 ' : ''}${visibilityTarget}로 변경`;

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
            <div className="flex items-stretch border-b border-line-light">
                <a
                    href={`/@${username}/${post.url}`}
                    aria-label={`${post.title} 포스트 보기`}
                    className="flex min-w-0 flex-1 items-center gap-3 p-4 transition-colors hover:bg-surface-subtle/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-action">
                    <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-line-light bg-surface-subtle">
                        {post.image ? (
                            <img
                                src={getMediaPath(post.image)}
                                alt=""
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
                                    {isScheduled ? '발행 후 비공개' : '비공개'}
                                </span>
                            )}
                        </div>
                    </div>
                </a>

                {/* 액션 */}
                <div className="flex flex-shrink-0 items-center pr-3 sm:pr-4">
                    <Dropdown
                        density="compact"
                        triggerAriaLabel={`${post.title} 포스트 메뉴 열기`}
                        triggerClassName="min-h-11 min-w-11 focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-1 [@media(pointer:fine)]:min-h-9 [@media(pointer:fine)]:min-w-9"
                        items={[
                            {
                                label: '포스트 편집',
                                icon: <Pencil aria-hidden className="h-4 w-4" />,
                                onClick: handleEditPost
                            },
                            {
                                label: visibilityActionLabel,
                                icon: post.isHide
                                    ? <Eye aria-hidden className="h-4 w-4" />
                                    : <EyeOff aria-hidden className="h-4 w-4" />,
                                onClick: () => onVisibilityToggle(post.url)
                            },
                            {
                                label: '휴지통으로 이동',
                                icon: <Trash2 aria-hidden className="h-4 w-4" />,
                                onClick: () => onDelete(post.url),
                                variant: 'danger'
                            }
                        ]}
                    />
                </div>
            </div>

            <div className="flex items-center gap-3 bg-surface-subtle/40 px-4 py-2.5">
                {!isMetaEditorOpen && classificationSummary && (
                    <span className="min-w-0 truncate text-xs text-content-hint">
                        {classificationSummary}
                    </span>
                )}
                <button
                    type="button"
                    aria-label={isMetaEditorOpen ? '태그 및 시리즈 편집 닫기' : '태그 및 시리즈 편집 열기'}
                    onClick={() => setIsMetaEditorOpen(prev => !prev)}
                    className="ml-auto inline-flex min-h-11 flex-shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-content-secondary transition-colors hover:bg-surface-subtle hover:text-content [@media(pointer:fine)]:min-h-9">
                    <SlidersHorizontal aria-hidden className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">태그·시리즈</span>
                    <span className="inline-flex items-center gap-2">
                        {hasPendingChanges && (
                            <span
                                role="status"
                                className="rounded bg-action px-2 py-0.5 text-[11px] text-content-inverted">
                                {pendingChangeLabel} 저장 필요
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
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                        <div className={getSettingsIconClass('light')}>
                            <Tag aria-hidden className="h-4 w-4" />
                        </div>
                        <Input
                            density="compact"
                            type="text"
                            aria-label={`${post.title} 태그`}
                            placeholder="태그를 입력하세요..."
                            value={post.tag}
                            onChange={(e) => onTagChange(post.url, e.target.value)}
                            className="w-full"
                        />
                        {(post.hasTagChanged || isTagSaving) && (
                            <Button
                                density="compact"
                                variant="primary"
                                size="md"
                                isLoading={isTagSaving}
                                className="col-start-2 min-h-11! w-full sm:col-start-auto [@media(pointer:fine)]:min-h-10! sm:w-auto"
                                leftIcon={<Save aria-hidden className="h-4 w-4" />}
                                onClick={() => onTagSubmit(post.url)}>
                                태그 저장
                            </Button>
                        )}
                    </div>

                    {/* 시리즈 */}
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                        <div className={getSettingsIconClass('light')}>
                            <BookOpen aria-hidden className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                            <Select
                                density="compact"
                                value={post.series || ''}
                                onValueChange={(value) => onSeriesChange(post.url, value)}
                                ariaLabel={`${post.title} 시리즈 선택`}
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
                        {(post.hasSeriesChanged || isSeriesSaving) && (
                            <Button
                                density="compact"
                                variant="primary"
                                size="md"
                                isLoading={isSeriesSaving}
                                className="col-start-2 min-h-11! w-full sm:col-start-auto [@media(pointer:fine)]:min-h-10! sm:w-auto"
                                leftIcon={<Save aria-hidden className="h-4 w-4" />}
                                onClick={() => onSeriesSubmit(post.url)}>
                                시리즈 저장
                            </Button>
                        )}
                    </div>

                </div>
            )}
        </div>
    );
};

export default PostCard;
