import { useEffect } from 'react';
import { useLingui } from '@lingui/react/macro';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Clock, FileText, RotateCcw, Trash2 } from '@blex/ui/icons';
import { Dropdown } from '~/components/shared';
import { useConfirm } from '~/hooks/useConfirm';
import {
    getTrashedPosts,
    permanentlyDeleteTrashedPost,
    restoreTrashedPost,
    type TrashedPost,
    type TrashedPostSourceStatus
} from '~/lib/api/posts';
import { getMediaPath } from '~/modules/static.module';
import {
    getSettingsIconClass,
    SETTINGS_LIST_META,
    SETTINGS_LIST_TITLE
} from '~/styles/settingsStyles';
import { toast } from '~/utils/toast';
import { SettingsEmptyState, SettingsListItem } from '../../../components';
import Pagination from './Pagination';
import { formatDateTime } from '~/i18n/formatters';
import { normalizeLocale } from '~/i18n/locale';

interface TrashPostListContentProps {
    page: string;
    onPageChange: (page: string) => void;
    onCountChange?: (count: number) => void;
}

export const TrashPostListContent = ({
    page,
    onPageChange,
    onCountChange
}: TrashPostListContentProps) => {
    const { i18n, t } = useLingui();
    const { confirm } = useConfirm();
    const getSourceStatusLabel = (status: TrashedPostSourceStatus) => {
        switch (status) {
            case 'draft':
                return t({
                    id: 'settings.posts.status.draft',
                    message: 'Draft'
                });
            case 'scheduled':
                return t({
                    id: 'settings.posts.status.scheduled',
                    message: 'Scheduled'
                });
            case 'published':
                return t({
                    id: 'settings.posts.status.published',
                    message: 'Published'
                });
        }
    };
    const getRestoreMessage = (post: TrashedPost) => {
        if (post.scheduleElapsed) {
            return t({
                id: 'settings.posts.trash.restore.elapsed_message',
                message: 'The scheduled time has passed, so this post will be published when restored. Its previous visibility setting will be preserved.'
            });
        }
        return i18n._({
            id: 'settings.posts.trash.restore.message',
            message: 'Restore this post as {status}. Its URL, publication status, and visibility will return to their previous settings.',
            values: { status: getSourceStatusLabel(post.sourceStatus) }
        });
    };
    const normalizedPage = Number.parseInt(page, 10) || 1;
    const { data: trashData, refetch } = useSuspenseQuery({
        queryKey: ['trash-posts', normalizedPage],
        queryFn: async () => {
            const { data } = await getTrashedPosts(normalizedPage);
            if (data.status === 'DONE') return data.body;
            throw new Error(data.errorMessage || t({
                id: 'settings.posts.trash.load_failed',
                message: 'Could not load the trash.'
            }));
        }
    });

    useEffect(() => {
        onCountChange?.(trashData.pagination.totalCount);
    }, [onCountChange, trashData.pagination.totalCount]);

    const refreshAfterRemoval = () => {
        if (trashData.posts.length === 1 && normalizedPage > 1) {
            onPageChange(String(normalizedPage - 1));
            return;
        }
        void refetch();
    };

    const handleRestore = async (post: TrashedPost) => {
        const confirmed = await confirm({
            title: t({
                id: 'settings.posts.trash.restore.title',
                message: 'Restore post'
            }),
            message: getRestoreMessage(post),
            confirmText: t({
                id: 'common.restore',
                message: 'Restore'
            })
        });
        if (!confirmed) return;

        try {
            const { data } = await restoreTrashedPost(post.url, post.deletedDate);
            if (data.status === 'ERROR') {
                toast.error(data.errorMessage || t({
                    id: 'settings.posts.trash.restore.failed',
                    message: 'Could not restore the post.'
                }));
                return;
            }
            toast.success(i18n._({
                id: 'settings.posts.trash.restore.success',
                message: 'Post restored as {status}.',
                values: { status: getSourceStatusLabel(data.body.status) }
            }));
            refreshAfterRemoval();
        } catch {
            toast.error(t({
                id: 'settings.posts.trash.restore.failed',
                message: 'Could not restore the post.'
            }));
        }
    };

    const handlePermanentDelete = async (post: TrashedPost) => {
        const displayTitle = post.title || t({
            id: 'common.untitled',
            message: 'Untitled'
        });
        const confirmed = await confirm({
            title: t({
                id: 'settings.posts.trash.delete.title',
                message: 'Permanently delete post'
            }),
            message: i18n._({
                id: 'settings.posts.trash.delete.message',
                message: 'Permanently delete “{title}” and its related data? This action cannot be undone.',
                values: { title: displayTitle }
            }),
            confirmText: t({
                id: 'settings.posts.trash.delete.confirm',
                message: 'Delete permanently'
            }),
            variant: 'danger'
        });
        if (!confirmed) return;

        try {
            const { data } = await permanentlyDeleteTrashedPost(
                post.url,
                post.deletedDate
            );
            if (data.status === 'ERROR') {
                toast.error(data.errorMessage || t({
                    id: 'settings.posts.trash.delete.failed',
                    message: 'Could not permanently delete the post.'
                }));
                return;
            }
            toast.success(t({
                id: 'settings.posts.trash.delete.success',
                message: 'Post permanently deleted.'
            }));
            refreshAfterRemoval();
        } catch {
            toast.error(t({
                id: 'settings.posts.trash.delete.failed',
                message: 'Could not permanently delete the post.'
            }));
        }
    };

    if (trashData.posts.length === 0) {
        return (
            <SettingsEmptyState
                icon={<Trash2 aria-hidden className="h-5 w-5" />}
                title={t({
                    id: 'settings.posts.trash.empty',
                    message: 'Trash is empty'
                })}
            />
        );
    }

    return (
        <>
            <p className="mb-4 text-sm text-content-secondary">
                {t({
                    id: 'settings.posts.trash.retention',
                    message: 'Posts in the trash are not deleted automatically.'
                })}
            </p>
            <div className="space-y-3">
                {trashData.posts.map(post => {
                    const displayTitle = post.title || t({
                        id: 'common.untitled',
                        message: 'Untitled'
                    });

                    return (
                        <SettingsListItem
                            key={`${post.url}-${post.deletedDate}`}
                            left={post.image ? (
                                <div className={`${getSettingsIconClass('default')} overflow-hidden`}>
                                    <img
                                        src={getMediaPath(post.image)}
                                        alt={displayTitle}
                                        loading="lazy"
                                        className="h-full w-full object-cover"
                                    />
                                </div>
                        ) : (
                            <div className={getSettingsIconClass('default')}>
                                <FileText aria-hidden className="h-4 w-4" />
                            </div>
                        )}
                            actions={(
                                <Dropdown
                                    density="compact"
                                    triggerAriaLabel={i18n._({
                                    id: 'settings.posts.trash.open_menu',
                                    message: 'Open trash menu: {title}',
                                    values: { title: displayTitle }
                                })}
                                    triggerClassName="min-h-11 min-w-11 [@media(pointer:fine)]:min-h-9 [@media(pointer:fine)]:min-w-9"
                                    items={[
                                    {
                                        label: t({
                                            id: 'common.restore',
                                            message: 'Restore'
                                        }),
                                        icon: <RotateCcw aria-hidden className="h-4 w-4" />,
                                        onClick: () => void handleRestore(post)
                                    },
                                    {
                                        label: t({
                                            id: 'settings.posts.trash.delete.confirm',
                                            message: 'Delete permanently'
                                        }),
                                        icon: <Trash2 aria-hidden className="h-4 w-4" />,
                                        onClick: () => void handlePermanentDelete(post),
                                        variant: 'danger'
                                    }
                                ]}
                                />
                        )}>
                            <h3 className={`${SETTINGS_LIST_TITLE} mb-0.5`}>
                                {displayTitle}
                            </h3>
                            <div className={`${SETTINGS_LIST_META} flex flex-wrap items-center gap-3`}>
                                <span className="flex items-center">
                                    <Clock aria-hidden className="mr-1.5 h-3.5 w-3.5" />
                                    {i18n._({
                                    id: 'settings.posts.trash.moved_at',
                                    message: 'Moved {date}',
                                    values: {
                                        date: formatDateTime(
                                            post.deletedDate,
                                            normalizeLocale(i18n.locale),
                                            post.deletedDate
                                        )
                                    }
                                })}
                                </span>
                                <span className="rounded-md bg-surface-subtle px-2 py-0.5 text-xs font-medium text-content">
                                    {getSourceStatusLabel(post.sourceStatus)}
                                </span>
                                {post.isHide && (
                                <span className="rounded-md bg-surface-subtle px-2 py-0.5 text-xs font-medium text-content">
                                    {t({
                                        id: 'settings.posts.visibility.private',
                                        message: 'Private'
                                    })}
                                </span>
                            )}
                                {post.scheduleElapsed && (
                                <span className="text-warning">
                                    {t({
                                        id: 'settings.posts.trash.schedule_elapsed',
                                        message: 'Scheduled time passed'
                                    })}
                                </span>
                            )}
                            </div>
                        </SettingsListItem>
                    );
                })}
            </div>
            <Pagination
                page={String(trashData.pagination.page)}
                lastPage={trashData.pagination.lastPage}
                onPageChange={onPageChange}
            />
        </>
    );
};
