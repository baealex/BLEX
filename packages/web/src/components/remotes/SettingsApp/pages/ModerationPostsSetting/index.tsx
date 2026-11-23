import { useState } from 'react';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
 ExternalLink, Eye, EyeOff, FileText, RotateCcw, Trash2
} from '@blex/ui/icons';
import { toast } from '~/utils/toast';
import { useConfirm } from '~/hooks/useConfirm';
import { Button, Card, Input, Select } from '~/components/shared';
import { getDocumentTimeZone, normalizeLocale } from '~/i18n/locale';
import {
    getModeratedPosts,
    moveModeratedPostToTrash,
    restoreModeratedPost,
    setModeratedPostHidden,
    type ModeratedPost,
    type ModeratedPostFilter,
    type ModeratedPostStatus
} from '~/lib/api/settings';
import { SettingsHeader, SettingsPagination } from '../../components';
import { useModerationPaging, useModerationSearch } from '../shared/useModerationList';

const filterItems: Array<{ value: ModeratedPostFilter; label: MessageDescriptor }> = [
    {
        value: 'all',
        label: msg({
            id: 'settings.moderation.posts.filter.all',
            message: 'Public and hidden'
        })
    },
    {
        value: 'public',
        label: msg({
            id: 'settings.moderation.posts.status.public',
            message: 'Public'
        })
    },
    {
        value: 'hidden',
        label: msg({
            id: 'settings.moderation.posts.status.hidden',
            message: 'Hidden'
        })
    },
    {
        value: 'trash',
        label: msg({
            id: 'settings.moderation.posts.status.trash',
            message: 'Trash'
        })
    }
];

const statusClasses: Record<ModeratedPostStatus, string> = {
    public: 'bg-success-surface text-success',
    hidden: 'bg-warning-surface text-warning',
    trash: 'bg-danger-surface text-danger'
};

type PostAction = 'hide' | 'show' | 'trash' | 'restore';

const runAction = (post: ModeratedPost, action: PostAction) => {
    if (action === 'hide') return setModeratedPostHidden(post.id, true);
    if (action === 'show') return setModeratedPostHidden(post.id, false);
    if (action === 'trash') return moveModeratedPostToTrash(post.id);
    return restoreModeratedPost(post.id);
};

const ModerationPostsSetting = () => {
    const { i18n, t } = useLingui();
    const { confirm } = useConfirm();
    const queryClient = useQueryClient();
    const { page, query: appliedQuery, status, updateSearch } = useModerationSearch();
    const [draftQuery, setDraftQuery] = useState<string | null>(null);
    const query = draftQuery ?? appliedQuery;
    const filter = filterItems.find(item => item.value === status)?.value ?? 'all';
    const locale = normalizeLocale(i18n.locale);
    const failed = t({
        id: 'settings.moderation.action_failed',
        message: 'Could not complete this action.'
    });

    const { data, isError, isFetching, isPlaceholderData } = useQuery({
        queryKey: ['admin-moderated-posts', appliedQuery, filter, page],
        queryFn: async () => {
            const { data: response } = await getModeratedPosts(appliedQuery, filter, page);
            if (response.status === 'DONE') return response.body;
            throw new Error(response.errorMessage || failed);
        },
        placeholderData: previous => previous
    });
    const { listRef, goToPage } = useModerationPaging(page, updateSearch, data?.pagination, !isPlaceholderData);

    const actionMutation = useMutation({
        mutationFn: ({ post, action }: { post: ModeratedPost; action: PostAction }) => runAction(post, action),
        onSuccess: ({ data: response }, { action }) => {
            if (response.status !== 'DONE') {
                toast.error(response.errorMessage || failed);
                return;
            }
            const messages: Record<PostAction, string> = {
                hide: t({
                    id: 'settings.moderation.posts.hidden_done',
                    message: 'Post hidden.'
                }),
                show: t({
                    id: 'settings.moderation.posts.shown_done',
                    message: 'Post is public again.'
                }),
                trash: t({
                    id: 'settings.moderation.posts.trashed_done',
                    message: 'Post moved to trash.'
                }),
                restore: t({
                    id: 'settings.moderation.posts.restored_done',
                    message: 'Post restored.'
                })
            };
            toast.success(messages[action]);
            void queryClient.invalidateQueries({ queryKey: ['admin-moderated-posts'] });
        },
        onError: () => toast.error(failed)
    });

    const handleAction = async (post: ModeratedPost, action: PostAction) => {
        if (action === 'trash') {
            const confirmed = await confirm({
                title: t({
                    id: 'settings.moderation.posts.trash_title',
                    message: 'Move to trash'
                }),
                message: i18n._({
                    id: 'settings.moderation.posts.trash_message',
                    message: 'Move "{title}" by {author} to the trash? It disappears from the site, and you can restore it from the Trash filter.',
                    values: {
                        title: post.title,
                        author: post.author
                    }
                }),
                confirmText: t({
                    id: 'settings.moderation.posts.trash_confirm',
                    message: 'Move to trash'
                }),
                variant: 'danger'
            });
            if (!confirmed) return;
        }
        actionMutation.mutate({
            post,
            action
        });
    };

    const handleSearch = () => {
        setDraftQuery(null);
        updateSearch({
            q: query.trim() || undefined,
            page: undefined
        });
    };

    const isBusy = (post: ModeratedPost) => actionMutation.isPending && actionMutation.variables?.post.id === post.id;
    const formatDate = (value: string | null) => (value
        ? new Intl.DateTimeFormat(locale, {
            dateStyle: 'medium',
            timeZone: getDocumentTimeZone()
        }).format(new Date(value))
        : '-');
    const posts = data?.posts ?? [];

    return (
        <div className="space-y-8">
            <SettingsHeader
                title={t({
                    id: 'settings.moderation.posts.title',
                    message: 'All posts'
                })}
                description={t({
                    id: 'settings.moderation.posts.description',
                    message: 'Hide or remove published posts from any author. Drafts and scheduled posts stay private.'
                })}
            />

            <Card
                title={t({
                    id: 'settings.moderation.posts.list_title',
                    message: 'Published posts'
                })}
                subtitle={data ? i18n._({
                    id: 'settings.moderation.total',
                    message: '{total} total',
                    values: { total: data.pagination.total }
                }) : undefined}
                icon={<FileText aria-hidden="true" className="h-4 w-4" />}>
                <div className="mb-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
                    <Input
                        density="compact"
                        aria-label={t({
                            id: 'settings.moderation.posts.search_label',
                            message: 'Search posts'
                        })}
                        placeholder={t({
                            id: 'settings.moderation.posts.search_placeholder',
                            message: 'Search title or author'
                        })}
                        value={query}
                        onChange={(event) => setDraftQuery(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') handleSearch();
                        }}
                    />
                    <Select
                        density="compact"
                        value={filter}
                        ariaLabel={t({
                            id: 'settings.moderation.posts.filter_label',
                            message: 'Filter posts by status'
                        })}
                        onValueChange={(value) => {
                            updateSearch({
                                status: value === 'all' ? undefined : value,
                                page: undefined
                            });
                        }}
                        items={filterItems.map(item => ({
                            value: item.value,
                            label: i18n._(item.label)
                        }))}
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
                    {posts.map(post => (
                        <div key={post.id} className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0">
                                <div className="flex min-w-0 items-center gap-2">
                                    <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${statusClasses[post.status]}`}>
                                        {i18n._(filterItems.find(item => item.value === post.status)!.label)}
                                    </span>
                                    {post.status === 'public' && post.authorActive ? (
                                        <a
                                            href={post.path}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex min-w-0 items-center gap-1 text-sm font-semibold text-content hover:underline">
                                            <span className="truncate">{post.title}</span>
                                            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-content-hint" />
                                        </a>
                                    ) : (
                                        <span className="truncate text-sm font-semibold text-content">{post.title}</span>
                                    )}
                                </div>
                                <p className="mt-1 truncate text-xs text-content-secondary">
                                    {i18n._({
                                        id: 'settings.moderation.posts.meta',
                                        message: '{author} · {date} · {comments} comments · {likes} likes',
                                        values: {
                                            author: post.author,
                                            date: formatDate(post.status === 'trash' ? post.deletedDate : post.publishedDate),
                                            comments: post.commentCount,
                                            likes: post.likeCount
                                        }
                                    })}
                                    {!post.authorActive && (
                                        <span className="ml-1 text-danger">
                                            <Trans id="settings.moderation.posts.author_inactive">(inactive author)</Trans>
                                        </span>
                                    )}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2 lg:flex-shrink-0">
                                {post.status === 'trash' ? (
                                    <Button
                                        density="compact"
                                        size="sm"
                                        variant="secondary"
                                        isLoading={isBusy(post)}
                                        onClick={() => void handleAction(post, 'restore')}>
                                        <RotateCcw aria-hidden="true" className="h-4 w-4" />
                                        <Trans id="settings.moderation.posts.restore">Restore</Trans>
                                    </Button>
                                ) : (
                                    <>
                                        <Button
                                            density="compact"
                                            size="sm"
                                            variant="secondary"
                                            isLoading={isBusy(post)}
                                            onClick={() => void handleAction(post, post.status === 'hidden' ? 'show' : 'hide')}>
                                            {post.status === 'hidden'
                                                ? <Eye aria-hidden="true" className="h-4 w-4" />
                                                : <EyeOff aria-hidden="true" className="h-4 w-4" />}
                                            {post.status === 'hidden'
                                                ? <Trans id="settings.moderation.posts.show">Make public</Trans>
                                                : <Trans id="settings.moderation.posts.hide">Hide</Trans>}
                                        </Button>
                                        <Button
                                            density="compact"
                                            size="sm"
                                            variant="danger"
                                            disabled={isBusy(post)}
                                            onClick={() => void handleAction(post, 'trash')}>
                                            <Trash2 aria-hidden="true" className="h-4 w-4" />
                                            <Trans id="settings.moderation.posts.trash_confirm">Move to trash</Trans>
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}

                    {isError ? (
                        <div className="px-4 py-8 text-center text-sm text-danger">
                            <Trans id="settings.moderation.load_failed">Could not load the list. Try again shortly.</Trans>
                        </div>
                    ) : data && posts.length === 0 && (
                        <div className="px-4 py-8 text-center text-sm text-content-secondary">
                            <Trans id="settings.moderation.posts.empty">No posts match your search.</Trans>
                        </div>
                    )}
                </div>

                {data && (
                    <SettingsPagination
                        page={String(data.pagination.page)}
                        lastPage={data.pagination.totalPages}
                        ariaLabel={t({
                            id: 'settings.posts.pagination.aria',
                            message: 'Post pages'
                        })}
                        onPageChange={value => goToPage(Number(value))}
                    />
                )}
            </Card>
        </div>
    );
};

export default ModerationPostsSetting;
