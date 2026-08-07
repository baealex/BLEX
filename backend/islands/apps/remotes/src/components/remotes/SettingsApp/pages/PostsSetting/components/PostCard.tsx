import { type ReactNode, useEffect, useState } from 'react';
import { useLingui } from '@lingui/react/macro';
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
import { formatDateOnly } from '~/i18n/formatters';
import { normalizeLocale } from '~/i18n/locale';

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
    const { i18n, t } = useLingui();
    const [isMetaEditorOpen, setIsMetaEditorOpen] = useState(false);
    const hasPendingChanges = !!post.hasTagChanged || !!post.hasSeriesChanged;
    const pendingChangeLabel = post.hasTagChanged && post.hasSeriesChanged
        ? t({
            id: 'settings.posts.classification.tags_and_series',
            message: 'Tags and series'
        })
        : post.hasTagChanged
            ? t({
                id: 'settings.posts.classification.tags',
                message: 'Tags'
            })
            : t({
                id: 'settings.posts.classification.series',
                message: 'Series'
            });
    const tagCount = post.tag
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean).length;
    const seriesTitle = series?.find(item => item.url === post.series)?.title;
    const classificationSummary = [
        tagCount > 0
            ? i18n._({
                id: 'settings.posts.classification.tag_count',
                message: '{count, plural, one {# tag} other {# tags}}',
                values: { count: tagCount }
            })
            : '',
        seriesTitle || ''
    ].filter(Boolean).join(' · ');
    const visibilityActionLabel = post.isHide
        ? isScheduled
            ? t({
                id: 'settings.posts.visibility.make_public_after_publish',
                message: 'Make public after publishing'
            })
            : t({
                id: 'settings.posts.visibility.make_public',
                message: 'Make public'
            })
        : isScheduled
            ? t({
                id: 'settings.posts.visibility.make_private_after_publish',
                message: 'Make private after publishing'
            })
            : t({
                id: 'settings.posts.visibility.make_private',
                message: 'Make private'
            });
    const displayTitle = post.title || t({
        id: 'common.untitled',
        message: 'Untitled'
    });

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
            {/* Header */}
            <div className="flex items-stretch border-b border-line-light">
                <a
                    href={`/@${username}/${post.url}`}
                    aria-label={i18n._({
                        id: 'settings.posts.card.view_post',
                        message: 'View post: {title}',
                        values: { title: displayTitle }
                    })}
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

                    {/* Title */}
                    <div className="flex-1 min-w-0 py-0.5">
                        <h3 className="text-base font-semibold text-content leading-snug line-clamp-2">
                            {displayTitle}
                        </h3>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-content-secondary">
                            <span className="inline-flex items-center gap-1.5">
                                {dateIcon ?? (
                                    dateIconClass
                                        ? <i aria-hidden className={`${dateIconClass} text-content-hint`} />
                                        : <Calendar aria-hidden className="h-3.5 w-3.5 text-content-hint" />
                                )}
                                {dateDisplay || formatDateOnly(
                                    post.createdDate,
                                    normalizeLocale(i18n.locale),
                                    post.createdDate
                                )}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <Clock aria-hidden className="h-3.5 w-3.5 text-content-hint" />
                                {i18n._({
                                    id: 'settings.posts.card.read_time',
                                    message: '{minutes, plural, one {# min} other {# min}}',
                                    values: { minutes: post.readTime }
                                })}
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
                                <span className="text-content-hint">
                                    {t({
                                        id: 'settings.posts.card.recently_updated',
                                        message: 'Recently updated'
                                    })}
                                </span>
                            )}
                            {statusLabel && (
                                <span className="inline-flex items-center px-2 py-0.5 bg-surface-subtle text-content rounded-md font-medium">
                                    {statusLabel}
                                </span>
                            )}
                            {post.isHide && (
                                <span className="inline-flex items-center px-2 py-0.5 bg-surface-subtle text-content rounded-md font-medium">
                                    {isScheduled
                                        ? t({
                                            id: 'settings.posts.visibility.private_after_publish',
                                            message: 'Private after publishing'
                                        })
                                        : t({
                                            id: 'settings.posts.visibility.private',
                                            message: 'Private'
                                        })}
                                </span>
                            )}
                        </div>
                    </div>
                </a>

                {/* Actions */}
                <div className="flex flex-shrink-0 items-center pr-3 sm:pr-4">
                    <Dropdown
                        density="compact"
                        triggerAriaLabel={i18n._({
                            id: 'settings.posts.card.open_menu',
                            message: 'Open post menu: {title}',
                            values: { title: displayTitle }
                        })}
                        triggerClassName="min-h-11 min-w-11 focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-1 [@media(pointer:fine)]:min-h-9 [@media(pointer:fine)]:min-w-9"
                        items={[
                            {
                                label: t({
                                    id: 'settings.posts.card.edit',
                                    message: 'Edit post'
                                }),
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
                                label: t({
                                    id: 'settings.posts.trash.move.confirm',
                                    message: 'Move to trash'
                                }),
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
                    aria-label={isMetaEditorOpen
                        ? t({
                            id: 'settings.posts.classification.close',
                            message: 'Close tag and series editor'
                        })
                        : t({
                            id: 'settings.posts.classification.open',
                            message: 'Open tag and series editor'
                        })}
                    onClick={() => setIsMetaEditorOpen(prev => !prev)}
                    className="ml-auto inline-flex min-h-11 flex-shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-content-secondary transition-colors hover:bg-surface-subtle hover:text-content [@media(pointer:fine)]:min-h-9">
                    <SlidersHorizontal aria-hidden className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">
                        {t({
                            id: 'settings.posts.classification.label',
                            message: 'Tags · Series'
                        })}
                    </span>
                    <span className="inline-flex items-center gap-2">
                        {hasPendingChanges && (
                            <span
                                role="status"
                                className="rounded bg-action px-2 py-0.5 text-[11px] text-content-inverted">
                                {i18n._({
                                    id: 'settings.posts.classification.save_required',
                                    message: '{fields}: save required',
                                    values: { fields: pendingChangeLabel }
                                })}
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
                    {/* Tags */}
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                        <div className={getSettingsIconClass('light')}>
                            <Tag aria-hidden className="h-4 w-4" />
                        </div>
                        <Input
                            density="compact"
                            type="text"
                            aria-label={i18n._({
                                id: 'settings.posts.tags.input_aria',
                                message: 'Tags for {title}',
                                values: { title: displayTitle }
                            })}
                            placeholder={t({
                                id: 'settings.posts.tags.placeholder',
                                message: 'Enter tags...'
                            })}
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
                                {t({
                                    id: 'settings.posts.tags.save',
                                    message: 'Save tags'
                                })}
                            </Button>
                        )}
                    </div>

                    {/* Series */}
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                        <div className={getSettingsIconClass('light')}>
                            <BookOpen aria-hidden className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                            <Select
                                density="compact"
                                value={post.series || ''}
                                onValueChange={(value) => onSeriesChange(post.url, value)}
                                ariaLabel={i18n._({
                                    id: 'settings.posts.series.select_aria',
                                    message: 'Select series for {title}',
                                    values: { title: displayTitle }
                                })}
                                items={[
                                    {
                                        value: '',
                                        label: t({
                                            id: 'settings.posts.series.none',
                                            message: 'No series'
                                        })
                                    },
                                    ...(series?.map((item) => ({
                                        value: item.url,
                                        label: item.title
                                    })) || [])
                                ]}
                                placeholder={t({
                                    id: 'settings.posts.series.none',
                                    message: 'No series'
                                })}
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
                                {t({
                                    id: 'settings.posts.series.save',
                                    message: 'Save series'
                                })}
                            </Button>
                        )}
                    </div>

                </div>
            )}
        </div>
    );
};

export default PostCard;
