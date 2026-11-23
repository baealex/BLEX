import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, MessageCircle, Trash2 } from '@blex/ui/icons';
import { toast } from '~/utils/toast';
import { useConfirm } from '~/hooks/useConfirm';
import { Button, Card, Input } from '~/components/shared';
import { getDocumentTimeZone, normalizeLocale } from '~/i18n/locale';
import {
    deleteModeratedComment,
    getModeratedComments,
    type ModeratedComment
} from '~/lib/api/settings';
import { SettingsHeader } from '../../components';
import { ModerationPager, usePageScroll } from '../shared/ModerationPager';

const ModerationCommentsSetting = () => {
    const { i18n, t } = useLingui();
    const { confirm } = useConfirm();
    const queryClient = useQueryClient();
    const [query, setQuery] = useState('');
    const [appliedQuery, setAppliedQuery] = useState('');
    const [page, setPage] = useState(1);
    const locale = normalizeLocale(i18n.locale);
    const failed = t({
        id: 'settings.moderation.action_failed',
        message: 'Could not complete this action.'
    });

    const { data, isError, isFetching, isPlaceholderData } = useQuery({
        queryKey: ['admin-moderated-comments', appliedQuery, page],
        queryFn: async () => {
            const { data: response } = await getModeratedComments(appliedQuery, page);
            if (response.status === 'DONE') return response.body;
            throw new Error(response.errorMessage || failed);
        },
        placeholderData: previous => previous
    });
    const { listRef, markPageChange } = usePageScroll(!isPlaceholderData, data);

    const deleteMutation = useMutation({
        mutationFn: (comment: ModeratedComment) => deleteModeratedComment(comment.id),
        onSuccess: ({ data: response }) => {
            if (response.status !== 'DONE') {
                toast.error(response.errorMessage || failed);
                return;
            }
            toast.success(t({
                id: 'settings.moderation.comments.deleted',
                message: 'Comment deleted.'
            }));
            void queryClient.invalidateQueries({ queryKey: ['admin-moderated-comments'] });
        },
        onError: () => toast.error(failed)
    });

    const handleDelete = async (comment: ModeratedComment) => {
        const confirmed = await confirm({
            title: t({
                id: 'settings.moderation.comments.delete_title',
                message: 'Delete comment'
            }),
            message: i18n._({
                id: 'settings.moderation.comments.delete_message',
                message: 'Delete this comment by {author}? Visitors will see it as a deleted comment, and this cannot be undone here.',
                values: { author: comment.author }
            }),
            confirmText: t({
                id: 'common.delete',
                message: 'Delete'
            }),
            variant: 'danger'
        });
        if (confirmed) deleteMutation.mutate(comment);
    };

    const handlePageChange = (nextPage: number) => {
        if (nextPage === page) return;
        markPageChange();
        setPage(nextPage);
    };

    const handleSearch = () => {
        setPage(1);
        setAppliedQuery(query.trim());
    };

    const formatDate = (value: string | null) => (value
        ? new Intl.DateTimeFormat(locale, {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: getDocumentTimeZone()
        }).format(new Date(value))
        : '-');
    const comments = data?.comments ?? [];

    return (
        <div className="space-y-8">
            <SettingsHeader
                title={t({
                    id: 'settings.moderation.comments.title',
                    message: 'All comments'
                })}
                description={t({
                    id: 'settings.moderation.comments.description',
                    message: 'Find and remove comments from any post.'
                })}
            />

            <Card
                title={t({
                    id: 'settings.moderation.comments.list_title',
                    message: 'Recent comments'
                })}
                icon={<MessageCircle aria-hidden="true" className="h-4 w-4" />}>
                <div className="mb-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                    <Input
                        density="compact"
                        aria-label={t({
                            id: 'settings.moderation.comments.search_label',
                            message: 'Search comments'
                        })}
                        placeholder={t({
                            id: 'settings.moderation.comments.search_placeholder',
                            message: 'Search comment text or author'
                        })}
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') handleSearch();
                        }}
                    />
                    <Button density="compact" variant="secondary" onClick={handleSearch}>
                        <Trans id="common.search">Search</Trans>
                    </Button>
                </div>

                {isFetching && data && (
                    <p className="mb-3 text-xs text-content-secondary">
                        <Trans id="settings.moderation.updating">Updating the list…</Trans>
                    </p>
                )}

                <div ref={listRef} className="scroll-mt-24 divide-y divide-line overflow-hidden rounded-xl border border-line">
                    {comments.map(comment => (
                        <div key={comment.id} className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 flex-1">
                                <p className="text-xs text-content-secondary">
                                    <span className="font-semibold text-content">{comment.author}</span>
                                    {' · '}{formatDate(comment.createdDate)}
                                    {comment.isReply && (
                                        <>{' · '}<Trans id="settings.moderation.comments.reply">Reply</Trans></>
                                    )}
                                    {comment.isEdited && (
                                        <>{' · '}<Trans id="settings.moderation.comments.edited">Edited</Trans></>
                                    )}
                                </p>
                                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-content">{comment.excerpt}</p>
                                <a
                                    href={comment.postPath}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-2 inline-flex max-w-full items-center gap-1 text-xs text-content-secondary hover:underline">
                                    <span className="truncate">{comment.postTitle}</span>
                                    <ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0 text-content-hint" />
                                </a>
                            </div>
                            <Button
                                density="compact"
                                size="sm"
                                variant="danger"
                                isLoading={deleteMutation.isPending && deleteMutation.variables?.id === comment.id}
                                onClick={() => void handleDelete(comment)}>
                                <Trash2 aria-hidden="true" className="h-4 w-4" />
                                <Trans id="common.delete">Delete</Trans>
                            </Button>
                        </div>
                    ))}

                    {isError ? (
                        <div className="px-4 py-8 text-center text-sm text-danger">
                            <Trans id="settings.moderation.load_failed">Could not load the list. Try again shortly.</Trans>
                        </div>
                    ) : data && comments.length === 0 && (
                        <div className="px-4 py-8 text-center text-sm text-content-secondary">
                            <Trans id="settings.moderation.comments.empty">No comments match your search.</Trans>
                        </div>
                    )}
                </div>

                {data && <ModerationPager pagination={data.pagination} onPageChange={handlePageChange} />}
            </Card>
        </div>
    );
};

export default ModerationCommentsSetting;
