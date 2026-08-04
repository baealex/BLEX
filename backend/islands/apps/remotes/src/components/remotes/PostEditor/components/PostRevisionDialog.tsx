import { useCallback, useEffect, useRef, useState } from 'react';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { Button } from '@blex/ui/button';
import { Dialog } from '@blex/ui/dialog';
import { IconButton } from '@blex/ui/icon-button';
import {
    AlertTriangle,
    ArrowLeft,
    ChevronRight,
    Clock,
    History,
    Loader2,
    RotateCcw,
    Trash2,
    X
} from '@blex/ui/icons';
import {
    DIM_OVERLAY_DEFAULT,
    ENTRANCE_DURATION
} from '@blex/ui/design-tokens';
import { cx } from '~/lib/classnames';
import { normalizeLocale } from '~/i18n/locale';
import {
    deletePostRevision,
    getPostRevision,
    getPostRevisions,
    restorePostRevision,
    type PostRevisionDetail,
    type PostRevisionSummary
} from '~/lib/api/posts';
import { toast } from '~/utils/toast';

interface PostRevisionDialogProps {
    isOpen: boolean;
    username: string;
    postUrl: string;
    expectedUpdatedDate: string;
    returnFocusTo?: HTMLButtonElement | null;
    onClose: () => void;
    onRestored: () => void;
}

const PostRevisionDialog = ({
    isOpen,
    username,
    postUrl,
    expectedUpdatedDate,
    returnFocusTo,
    onClose,
    onRestored
}: PostRevisionDialogProps) => {
    const { i18n, t } = useLingui();
    const [revisions, setRevisions] = useState<PostRevisionSummary[]>([]);
    const [selectedRevisionId, setSelectedRevisionId] = useState<number | null>(null);
    const [selectedRevision, setSelectedRevision] = useState<PostRevisionDetail | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [serverUpdatedDate, setServerUpdatedDate] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isConfirmingRestore, setIsConfirmingRestore] = useState(false);
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const detailRequestIdRef = useRef(0);
    const isDetailView = selectedRevisionId !== null;
    const changeTypeLabels = {
        edit: t({
            id: 'editor.revisions.change_type.edit',
            message: 'Before edit'
        }),
        restore: t({
            id: 'editor.revisions.change_type.restore',
            message: 'Before restore'
        }),
        legacy: t({
            id: 'editor.revisions.change_type.legacy',
            message: 'Legacy format'
        })
    } as const;
    const formatDateTime = (value: string) => {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return new Intl.DateTimeFormat(normalizeLocale(i18n.locale), {
            dateStyle: 'medium',
            timeStyle: 'short'
        }).format(date);
    };

    const handleBackToList = useCallback(() => {
        detailRequestIdRef.current += 1;
        setSelectedRevisionId(null);
        setSelectedRevision(null);
        setIsLoadingDetail(false);
        setIsConfirmingRestore(false);
        setIsConfirmingDelete(false);
    }, []);

    const loadDetail = useCallback(async (revisionId: number) => {
        const requestId = detailRequestIdRef.current + 1;
        detailRequestIdRef.current = requestId;
        setSelectedRevisionId(revisionId);
        setSelectedRevision(null);
        setIsConfirmingRestore(false);
        setIsConfirmingDelete(false);
        setIsLoadingDetail(true);

        try {
            const { data } = await getPostRevision(username, postUrl, revisionId);
            if (detailRequestIdRef.current !== requestId) return;
            if (data.status === 'ERROR') {
                toast.error(data.errorMessage || t({
                    id: 'editor.revisions.error.load_detail',
                    message: 'Could not load the revision.'
                }));
                handleBackToList();
                return;
            }
            setSelectedRevision(data.body.revision);
        } catch {
            if (detailRequestIdRef.current === requestId) {
                toast.error(t({
                    id: 'editor.revisions.error.load_detail',
                    message: 'Could not load the revision.'
                }));
                handleBackToList();
            }
        } finally {
            if (detailRequestIdRef.current === requestId) {
                setIsLoadingDetail(false);
            }
        }
    }, [username, postUrl, handleBackToList, t]);

    const loadFirstPage = useCallback(async () => {
        setIsLoading(true);
        setErrorMessage('');
        setRevisions([]);
        setCurrentPage(1);
        setLastPage(1);
        setTotalCount(0);
        setServerUpdatedDate('');
        handleBackToList();

        try {
            const { data } = await getPostRevisions(username, postUrl);
            if (data.status === 'ERROR') {
                setErrorMessage(data.errorMessage || t({
                    id: 'editor.revisions.error.load_list',
                    message: 'Could not load revision history.'
                }));
                return;
            }

            setRevisions(data.body.revisions);
            setCurrentPage(data.body.pagination.page);
            setLastPage(data.body.pagination.lastPage);
            setTotalCount(data.body.pagination.totalCount);
            setServerUpdatedDate(data.body.currentUpdatedDate);
        } catch {
            setErrorMessage(t({
                id: 'editor.revisions.error.load_list',
                message: 'Could not load revision history.'
            }));
        } finally {
            setIsLoading(false);
        }
    }, [username, postUrl, handleBackToList, t]);

    useEffect(() => {
        if (!isOpen) {
            detailRequestIdRef.current += 1;
            setIsConfirmingRestore(false);
            setIsConfirmingDelete(false);
            return;
        }
        void loadFirstPage();
    }, [isOpen, loadFirstPage]);

    const handleLoadMore = async () => {
        if (isLoadingMore || currentPage >= lastPage) return;
        setIsLoadingMore(true);
        try {
            const { data } = await getPostRevisions(username, postUrl, currentPage + 1);
            if (data.status === 'ERROR') {
                toast.error(data.errorMessage || t({
                    id: 'editor.revisions.error.load_more',
                    message: 'Could not load more revision history.'
                }));
                return;
            }
            setRevisions(current => [...current, ...data.body.revisions]);
            setCurrentPage(data.body.pagination.page);
            setLastPage(data.body.pagination.lastPage);
            setTotalCount(data.body.pagination.totalCount);
            setServerUpdatedDate(data.body.currentUpdatedDate);
        } catch {
            toast.error(t({
                id: 'editor.revisions.error.load_more',
                message: 'Could not load more revision history.'
            }));
        } finally {
            setIsLoadingMore(false);
        }
    };

    const hasVersionConflict = Boolean(
        serverUpdatedDate
        && expectedUpdatedDate
        && serverUpdatedDate !== expectedUpdatedDate
    );

    const handleDelete = async () => {
        if (!selectedRevision || isDeleting) return;

        setIsDeleting(true);
        try {
            const { data } = await deletePostRevision(
                username,
                postUrl,
                selectedRevision.id
            );
            if (data.status === 'ERROR') {
                toast.error(data.errorMessage || t({
                    id: 'editor.revisions.error.delete',
                    message: 'Could not delete the revision.'
                }));
                return;
            }

            toast.success(t({
                id: 'editor.revisions.success.deleted',
                message: 'Revision deleted.'
            }));
            await loadFirstPage();
        } catch {
            toast.error(t({
                id: 'editor.revisions.error.delete',
                message: 'Could not delete the revision.'
            }));
        } finally {
            setIsDeleting(false);
        }
    };

    const handleRestore = async () => {
        if (!selectedRevision?.canRestore || hasVersionConflict || isRestoring) return;

        setIsRestoring(true);
        try {
            const { data } = await restorePostRevision(
                username,
                postUrl,
                selectedRevision.id,
                expectedUpdatedDate
            );
            if (data.status === 'ERROR') {
                toast.error(data.errorMessage || t({
                    id: 'editor.revisions.error.restore',
                    message: 'Could not restore the revision.'
                }));
                return;
            }
            if (!data.body.restored) {
                toast.info(t({
                    id: 'editor.revisions.info.already_current',
                    message: 'The current post already matches this revision.'
                }));
                setIsConfirmingRestore(false);
                return;
            }

            toast.success(t({
                id: 'editor.revisions.success.restored',
                message: 'Revision restored.'
            }));
            onRestored();
        } catch {
            toast.error(t({
                id: 'editor.revisions.error.restore',
                message: 'Could not restore the revision.'
            }));
        } finally {
            setIsRestoring(false);
        }
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Dialog.Portal>
                <Dialog.Overlay
                    className={`fixed inset-0 ${DIM_OVERLAY_DEFAULT} z-[70] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0`}
                />
                <Dialog.Content
                    onEscapeKeyDown={(event) => {
                        event.preventDefault();
                        onClose();
                    }}
                    onCloseAutoFocus={(event) => {
                        if (!returnFocusTo?.isConnected) return;
                        event.preventDefault();
                        returnFocusTo.focus({ preventScroll: true });
                    }}
                    className={cx(
                        'fixed inset-y-0 left-0 z-[80] flex w-full flex-col bg-surface shadow-2xl focus:outline-none sm:w-[520px]',
                        'data-[state=open]:animate-in data-[state=closed]:animate-out',
                        'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
                        `${ENTRANCE_DURATION} ease-in-out`
                    )}>
                    <header className="flex items-start justify-between gap-3 border-b border-line bg-surface-elevated p-5">
                        <div className="flex min-w-0 items-start gap-2">
                            {isDetailView && (
                                <IconButton
                                    size="sm"
                                    aria-label={t({
                                        id: 'editor.revisions.back_to_list',
                                        message: 'Back to revision history'
                                    })}
                                    title={t({
                                        id: 'editor.revisions.back_to_list',
                                        message: 'Back to revision history'
                                    })}
                                    onClick={handleBackToList}>
                                    <ArrowLeft className="h-5 w-5" />
                                </IconButton>
                            )}
                            <div className="min-w-0 pt-1.5">
                                <div className="flex items-center gap-2">
                                    {!isDetailView && (
                                        <History aria-hidden="true" className="h-5 w-5 shrink-0 text-content-hint" />
                                    )}
                                    <Dialog.Title className="truncate text-lg font-semibold text-content">
                                        {isDetailView ? (
                                            <Trans id="editor.revisions.detail_title">Revision details</Trans>
                                        ) : (
                                            <Trans id="editor.revisions.title">Revision history</Trans>
                                        )}
                                    </Dialog.Title>
                                </div>
                                <Dialog.Description className="mt-1 text-xs leading-relaxed text-content-secondary">
                                    {isDetailView ? (
                                        <Trans id="editor.revisions.detail_description">
                                            Review, restore, or delete this saved revision
                                        </Trans>
                                    ) : (
                                        <Trans id="editor.revisions.description">
                                            Review snapshots saved before each content edit
                                        </Trans>
                                    )}
                                </Dialog.Description>
                            </div>
                        </div>
                        <IconButton
                            size="sm"
                            aria-label={t({
                                id: 'editor.revisions.close',
                                message: 'Close revision history'
                            })}
                            title={t({
                                id: 'editor.revisions.close',
                                message: 'Close revision history'
                            })}
                            onClick={onClose}>
                            <X className="h-5 w-5" />
                        </IconButton>
                    </header>

                    {!isDetailView ? (
                        <>
                            <div className="min-h-0 flex-1 overflow-y-auto">
                                {isLoading ? (
                                    <div className="flex h-full min-h-52 items-center justify-center" role="status">
                                        <Loader2 className="h-5 w-5 animate-spin text-content-hint" />
                                        <span className="sr-only">
                                            <Trans id="editor.revisions.loading">Loading revision history</Trans>
                                        </span>
                                    </div>
                                ) : errorMessage ? (
                                    <div className="flex h-full min-h-52 flex-col items-center justify-center gap-3 px-6 text-center">
                                        <AlertTriangle className="h-8 w-8 text-danger" aria-hidden="true" />
                                        <p className="text-sm text-content-secondary">{errorMessage}</p>
                                        <Button size="sm" variant="secondary" onClick={() => void loadFirstPage()}>
                                            <Trans id="common.retry">Try again</Trans>
                                        </Button>
                                    </div>
                                ) : revisions.length === 0 ? (
                                    <div className="flex h-full min-h-52 flex-col items-center justify-center gap-2 px-6 text-center">
                                        <History className="h-8 w-8 text-content-hint" aria-hidden="true" />
                                        <p className="text-sm font-medium text-content">
                                            <Trans id="editor.revisions.empty">No revision history yet</Trans>
                                        </p>
                                        <p className="text-xs leading-relaxed text-content-secondary">
                                            <Trans id="editor.revisions.empty_description">
                                                When you edit a published post, the previous version will appear here.
                                            </Trans>
                                        </p>
                                    </div>
                                ) : (
                                    <ul
                                        className="divide-y divide-line-light"
                                        aria-label={t({
                                            id: 'editor.revisions.list_aria_label',
                                            message: 'Revisions'
                                        })}>
                                        {revisions.map(revision => (
                                            <li key={revision.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => void loadDetail(revision.id)}
                                                    className="flex min-h-24 w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-action/30">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="min-w-0 truncate text-sm font-semibold text-content">
                                                                {revision.title || t({
                                                                    id: 'editor.common.untitled',
                                                                    message: 'Untitled'
                                                                })}
                                                            </span>
                                                            <span className="shrink-0 rounded-full bg-line-light px-2 py-0.5 text-[11px] font-medium text-content-secondary">
                                                                {changeTypeLabels[revision.changeType]}
                                                            </span>
                                                        </div>
                                                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-content-secondary">
                                                            {revision.contentExcerpt || t({
                                                                id: 'editor.revisions.no_content_preview',
                                                                message: 'No content preview'
                                                            })}
                                                        </p>
                                                        <span className="mt-2 flex items-center gap-1 text-[11px] text-content-hint">
                                                            <Clock className="h-3 w-3" aria-hidden="true" />
                                                            {formatDateTime(revision.createdDate)}
                                                        </span>
                                                    </div>
                                                    <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-content-hint" />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <footer className="border-t border-line bg-surface-subtle p-4">
                                {currentPage < lastPage && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        fullWidth
                                        isLoading={isLoadingMore}
                                        onClick={() => void handleLoadMore()}>
                                        <Trans id="common.load_more">Load more</Trans>
                                    </Button>
                                )}
                                <p
                                    className={cx(
                                        'text-center text-xs text-content-secondary',
                                        currentPage < lastPage && 'mt-2'
                                    )}>
                                    <Plural
                                        id="editor.revisions.total"
                                        value={totalCount}
                                        one="# revision"
                                        other="# revisions"
                                    />
                                </p>
                            </footer>
                        </>
                    ) : (
                        <>
                            <div className="min-h-0 flex-1 overflow-y-auto bg-surface p-5">
                                {isLoadingDetail ? (
                                    <div className="flex min-h-52 items-center justify-center" role="status">
                                        <Loader2 className="h-5 w-5 animate-spin text-content-hint" />
                                        <span className="sr-only">
                                            <Trans id="editor.revisions.loading_detail">Loading revision</Trans>
                                        </span>
                                    </div>
                                ) : selectedRevision ? (
                                    <article>
                                        <div className="border-b border-line pb-4">
                                            <p className="text-xs text-content-hint">
                                                {formatDateTime(selectedRevision.createdDate)} · {changeTypeLabels[selectedRevision.changeType]}
                                            </p>
                                            <h3 className="mt-2 break-words text-xl font-bold text-content">
                                                {selectedRevision.title || t({
                                                    id: 'editor.common.untitled',
                                                    message: 'Untitled'
                                                })}
                                            </h3>
                                            {selectedRevision.subtitle && (
                                                <p className="mt-2 break-words text-sm text-content-secondary">
                                                    {selectedRevision.subtitle}
                                                </p>
                                            )}
                                            {selectedRevision.tags.length > 0 && (
                                                <div
                                                    className="mt-3 flex flex-wrap gap-1.5"
                                                    aria-label={t({
                                                        id: 'editor.revisions.tags_aria_label',
                                                        message: 'Revision tags'
                                                    })}>
                                                    {selectedRevision.tags.map(tag => (
                                                        <span
                                                            key={tag}
                                                            className="rounded-full bg-surface-subtle px-2.5 py-1 text-xs text-content-secondary">
                                                            #{tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {selectedRevision.description && (
                                            <section className="border-b border-line py-4">
                                                <h4 className="text-xs font-semibold uppercase tracking-wide text-content-hint">
                                                    <Trans id="editor.fields.description">Description</Trans>
                                                </h4>
                                                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-content-secondary">
                                                    {selectedRevision.description}
                                                </p>
                                            </section>
                                        )}

                                        <section className="py-4">
                                            <h4 className="text-xs font-semibold uppercase tracking-wide text-content-hint">
                                                <Trans id="editor.fields.content">Content</Trans>
                                            </h4>
                                            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-content">
                                                {selectedRevision.contentText || t({
                                                    id: 'editor.revisions.no_content',
                                                    message: 'No content in this revision.'
                                                })}
                                            </p>
                                        </section>

                                        {!selectedRevision.canRestore && (
                                            <div className="flex gap-2 rounded-xl border border-line bg-surface-subtle p-3 text-sm text-content-secondary">
                                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                                <p>
                                                    <Trans id="editor.revisions.legacy_read_only">
                                                        Legacy revisions are read-only because their original format cannot be verified.
                                                    </Trans>
                                                </p>
                                            </div>
                                        )}
                                    </article>
                                ) : null}
                            </div>

                            {selectedRevision && (
                                <footer className="border-t border-line bg-surface-elevated p-4">
                                    {hasVersionConflict && (
                                        <div className="mb-3 flex gap-2 rounded-xl border border-danger/30 bg-danger-surface p-3 text-sm text-danger" role="alert">
                                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                            <p>
                                                <Trans id="editor.revisions.version_conflict">
                                                    The post changed after you opened this page. Refresh before restoring.
                                                </Trans>
                                            </p>
                                        </div>
                                    )}
                                    {isConfirmingDelete && (
                                        <div className="mb-3 rounded-xl border border-danger/30 bg-danger-surface p-3 text-sm leading-relaxed text-danger">
                                            <strong>
                                                <Trans id="editor.revisions.confirm_delete_title">
                                                    Delete the revision “{selectedRevision.title || t({
                                                        id: 'editor.common.untitled',
                                                        message: 'Untitled'
                                                    })}”?
                                                </Trans>
                                            </strong>
                                            <p className="mt-1">
                                                <Trans id="editor.revisions.confirm_delete_description">
                                                    Deleted revisions cannot be recovered. The current post will not change.
                                                </Trans>
                                            </p>
                                        </div>
                                    )}
                                    {isConfirmingRestore && (
                                        <div className="mb-3 rounded-xl border border-line bg-surface-subtle p-3 text-sm leading-relaxed text-content-secondary">
                                            <strong className="text-content">
                                                <Trans id="editor.revisions.confirm_restore_title">
                                                    Restore the revision “{selectedRevision.title || t({
                                                        id: 'editor.common.untitled',
                                                        message: 'Untitled'
                                                    })}”?
                                                </Trans>
                                            </strong>
                                            <p className="mt-1">
                                                <Trans id="editor.revisions.confirm_restore_description">
                                                    The current content will be saved as a revision first. The URL, publication, visibility, and comment settings will not change.
                                                </Trans>
                                            </p>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-end gap-2">
                                        {isConfirmingDelete ? (
                                            <>
                                                <Button
                                                    variant="secondary"
                                                    size="md"
                                                    disabled={isDeleting}
                                                    onClick={() => setIsConfirmingDelete(false)}>
                                                    <Trans id="common.cancel">Cancel</Trans>
                                                </Button>
                                                <Button
                                                    variant="danger-solid"
                                                    size="md"
                                                    isLoading={isDeleting}
                                                    leftIcon={<Trash2 className="h-4 w-4" />}
                                                    onClick={() => void handleDelete()}>
                                                    <Trans id="common.delete">Delete</Trans>
                                                </Button>
                                            </>
                                        ) : isConfirmingRestore ? (
                                            <>
                                                <Button
                                                    variant="secondary"
                                                    size="md"
                                                    disabled={isRestoring}
                                                    onClick={() => setIsConfirmingRestore(false)}>
                                                    <Trans id="common.cancel">Cancel</Trans>
                                                </Button>
                                                <Button
                                                    size="md"
                                                    isLoading={isRestoring}
                                                    disabled={!selectedRevision.canRestore || hasVersionConflict}
                                                    leftIcon={<RotateCcw className="h-4 w-4" />}
                                                    onClick={() => void handleRestore()}>
                                                    <Trans id="editor.revisions.restore">Restore</Trans>
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <Button
                                                    variant="danger"
                                                    size="md"
                                                    leftIcon={<Trash2 className="h-4 w-4" />}
                                                    onClick={() => {
                                                        setIsConfirmingRestore(false);
                                                        setIsConfirmingDelete(true);
                                                    }}>
                                                    <Trans id="common.delete">Delete</Trans>
                                                </Button>
                                                <Button
                                                    size="md"
                                                    disabled={!selectedRevision.canRestore || hasVersionConflict}
                                                    leftIcon={<RotateCcw className="h-4 w-4" />}
                                                    onClick={() => {
                                                        setIsConfirmingDelete(false);
                                                        setIsConfirmingRestore(true);
                                                    }}>
                                                    <Trans id="editor.revisions.restore_this">Restore this revision</Trans>
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </footer>
                            )}
                        </>
                    )}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

export default PostRevisionDialog;
