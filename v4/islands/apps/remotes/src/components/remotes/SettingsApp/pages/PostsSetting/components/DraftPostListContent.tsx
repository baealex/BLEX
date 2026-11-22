import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useLingui } from '@lingui/react/macro';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Clock, FileText, Trash2 } from '@blex/ui/icons';
import { SettingsEmptyState, SettingsListItem } from '../../../components';
import { Dropdown } from '~/components/shared';
import {
    getSettingsIconClass,
    SETTINGS_LIST_META,
    SETTINGS_LIST_TITLE
} from '~/styles/settingsStyles';
import { useConfirm } from '~/hooks/useConfirm';
import { getDraftPosts } from '~/lib/api/settings';
import { deleteDraft } from '~/lib/api/posts';
import { getMediaPath } from '~/modules/static.module';
import { toast } from '~/utils/toast';
import { formatDateOnly } from '~/i18n/formatters';
import { normalizeLocale } from '~/i18n/locale';

interface DraftPostListContentProps {
    onCountChange?: (count: number) => void;
    emptyAction?: ReactNode;
}

export const DraftPostListContent = ({
    onCountChange,
    emptyAction
}: DraftPostListContentProps) => {
    const { i18n, t } = useLingui();
    const { confirm } = useConfirm();
    const { data: draftPosts, refetch } = useSuspenseQuery({
        queryKey: ['draft-posts'],
        queryFn: async () => {
            const { data } = await getDraftPosts();
            if (data.status === 'DONE') {
                return data.body.drafts;
            }
            throw new Error(data.errorMessage || t({
                id: 'settings.posts.drafts.load_failed',
                message: 'Could not load drafts.'
            }));
        }
    });

    useEffect(() => {
        onCountChange?.(draftPosts?.length ?? 0);
    }, [draftPosts?.length, onCountChange]);

    const handleDraftDelete = async (url: string) => {
        const confirmed = await confirm({
            title: t({
                id: 'settings.posts.drafts.trash.title',
                message: 'Move draft to trash'
            }),
            message: t({
                id: 'settings.posts.drafts.trash.message',
                message: 'Move this draft to the trash? You can restore it later.'
            }),
            confirmText: t({
                id: 'settings.posts.trash.move.confirm',
                message: 'Move to trash'
            }),
            variant: 'danger'
        });

        if (!confirmed) return;

        try {
            const { data } = await deleteDraft(url);

            if (data.status === 'DONE') {
                toast.success(t({
                    id: 'settings.posts.drafts.trash.success',
                    message: 'Draft moved to trash.'
                }));
                refetch();
            } else {
                toast.error(data.errorMessage || t({
                    id: 'settings.posts.drafts.trash.failed',
                    message: 'Could not move the draft to trash.'
                }));
            }
        } catch {
            toast.error(t({
                id: 'settings.posts.drafts.trash.failed',
                message: 'Could not move the draft to trash.'
            }));
        }
    };

    const handleContinueDraft = (url: string) => {
        window.location.assign(`/write?draft=${url}`);
    };

    if (!draftPosts || draftPosts.length === 0) {
        return (
            <SettingsEmptyState
                icon={<FileText aria-hidden className="h-5 w-5" />}
                title={t({
                    id: 'settings.posts.empty.drafts',
                    message: 'No drafts'
                })}
                action={emptyAction}
            />
        );
    }

    return (
        <div className="space-y-3">
            {draftPosts.map((draftPost) => {
                const displayTitle = draftPost.title || t({
                    id: 'common.untitled',
                    message: 'Untitled'
                });

                return (
                    <SettingsListItem
                        key={draftPost.url}
                        onClick={() => handleContinueDraft(draftPost.url)}
                        left={
                        draftPost.image ? (
                            <div className={`${getSettingsIconClass('default')} overflow-hidden`}>
                                <img
                                    src={getMediaPath(draftPost.image)}
                                    alt={displayTitle}
                                    loading="lazy"
                                    className="h-full w-full object-cover"
                                />
                            </div>
                        ) : (
                            <div className={getSettingsIconClass('default')}>
                                <FileText aria-hidden className="h-4 w-4" />
                            </div>
                        )
                    }
                        actions={
                            <Dropdown
                                density="compact"
                                triggerAriaLabel={i18n._({
                                id: 'settings.posts.drafts.open_menu',
                                message: 'Open draft menu: {title}',
                                values: { title: displayTitle }
                            })}
                                triggerClassName="min-h-11 min-w-11 [@media(pointer:fine)]:min-h-9 [@media(pointer:fine)]:min-w-9"
                                items={[
                                {
                                    label: t({
                                        id: 'settings.posts.trash.move.confirm',
                                        message: 'Move to trash'
                                    }),
                                    icon: <Trash2 aria-hidden className="h-4 w-4" />,
                                    onClick: () => handleDraftDelete(draftPost.url),
                                    variant: 'danger'
                                }
                            ]}
                            />
                    }>
                        <h3 className={`${SETTINGS_LIST_TITLE} mb-0.5`}>
                            {displayTitle}
                        </h3>
                        <div className={`${SETTINGS_LIST_META} flex flex-wrap items-center gap-3`}>
                            <span className="flex items-center">
                                <Clock aria-hidden className="mr-1.5 h-3.5 w-3.5" />
                                {i18n._({
                                id: 'settings.posts.drafts.last_updated',
                                message: 'Last updated {date}',
                                values: {
                                    date: formatDateOnly(
                                        draftPost.updatedDate,
                                        normalizeLocale(i18n.locale),
                                        draftPost.updatedDate
                                    )
                                }
                            })}
                            </span>
                            <span className="bg-surface-subtle text-content px-2 py-0.5 rounded-md text-xs font-medium">
                                {t({
                                id: 'settings.posts.status.draft',
                                message: 'Draft'
                            })}
                            </span>
                        </div>
                    </SettingsListItem>
                );
            })}
        </div>
    );
};
