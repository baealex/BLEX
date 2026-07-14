import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@blex/ui/button';
import { Dialog } from '@blex/ui/dialog';
import { IconButton } from '@blex/ui/icon-button';
import {
    AlertTriangle,
    Clock,
    History,
    Loader2,
    RotateCcw,
    X
} from '@blex/ui/icons';
import { DIM_OVERLAY_DEFAULT } from '@blex/ui/design-tokens';
import { cx } from '~/lib/classnames';
import {
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

const changeTypeLabels = {
    edit: '수정 전',
    restore: '복원 전',
    legacy: '이전 형식'
} as const;

const formatDateTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('ko-KR', {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(date);
};

const PostRevisionDialog = ({
    isOpen,
    username,
    postUrl,
    expectedUpdatedDate,
    returnFocusTo,
    onClose,
    onRestored
}: PostRevisionDialogProps) => {
    const [revisions, setRevisions] = useState<PostRevisionSummary[]>([]);
    const [selectedRevisionId, setSelectedRevisionId] = useState<number | null>(null);
    const [selectedRevision, setSelectedRevision] = useState<PostRevisionDetail | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [serverUpdatedDate, setServerUpdatedDate] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [isConfirmingRestore, setIsConfirmingRestore] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const detailRequestIdRef = useRef(0);

    const loadDetail = useCallback(async (revisionId: number) => {
        const requestId = detailRequestIdRef.current + 1;
        detailRequestIdRef.current = requestId;
        setSelectedRevisionId(revisionId);
        setSelectedRevision(null);
        setIsConfirmingRestore(false);
        setIsLoadingDetail(true);

        try {
            const { data } = await getPostRevision(username, postUrl, revisionId);
            if (detailRequestIdRef.current !== requestId) return;
            if (data.status === 'ERROR') {
                toast.error(data.errorMessage || '수정본을 불러오지 못했습니다.');
                return;
            }
            setSelectedRevision(data.body.revision);
        } catch {
            if (detailRequestIdRef.current === requestId) {
                toast.error('수정본을 불러오지 못했습니다.');
            }
        } finally {
            if (detailRequestIdRef.current === requestId) {
                setIsLoadingDetail(false);
            }
        }
    }, [username, postUrl]);

    const loadFirstPage = useCallback(async () => {
        setIsLoading(true);
        setErrorMessage('');
        setRevisions([]);
        setSelectedRevisionId(null);
        setSelectedRevision(null);
        setCurrentPage(1);
        setLastPage(1);
        setServerUpdatedDate('');
        setIsConfirmingRestore(false);
        detailRequestIdRef.current += 1;

        try {
            const { data } = await getPostRevisions(username, postUrl);
            if (data.status === 'ERROR') {
                setErrorMessage(data.errorMessage || '수정 이력을 불러오지 못했습니다.');
                return;
            }

            setRevisions(data.body.revisions);
            setCurrentPage(data.body.pagination.page);
            setLastPage(data.body.pagination.lastPage);
            setServerUpdatedDate(data.body.currentUpdatedDate);
            const firstRevision = data.body.revisions[0];
            if (firstRevision) {
                void loadDetail(firstRevision.id);
            }
        } catch {
            setErrorMessage('수정 이력을 불러오지 못했습니다.');
        } finally {
            setIsLoading(false);
        }
    }, [username, postUrl, loadDetail]);

    useEffect(() => {
        if (!isOpen) {
            detailRequestIdRef.current += 1;
            setIsConfirmingRestore(false);
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
                toast.error(data.errorMessage || '다음 수정 이력을 불러오지 못했습니다.');
                return;
            }
            setRevisions(current => [...current, ...data.body.revisions]);
            setCurrentPage(data.body.pagination.page);
            setLastPage(data.body.pagination.lastPage);
            setServerUpdatedDate(data.body.currentUpdatedDate);
        } catch {
            toast.error('다음 수정 이력을 불러오지 못했습니다.');
        } finally {
            setIsLoadingMore(false);
        }
    };

    const hasVersionConflict = Boolean(
        serverUpdatedDate
        && expectedUpdatedDate
        && serverUpdatedDate !== expectedUpdatedDate
    );

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
                toast.error(data.errorMessage || '수정본을 복원하지 못했습니다.');
                return;
            }
            if (!data.body.restored) {
                toast.info('현재 포스트가 이미 선택한 수정본과 같습니다.');
                setIsConfirmingRestore(false);
                return;
            }

            toast.success('수정본을 복원했습니다.');
            onRestored();
        } catch {
            toast.error('수정본을 복원하지 못했습니다.');
        } finally {
            setIsRestoring(false);
        }
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Dialog.Portal>
                <Dialog.Overlay
                    className={`fixed inset-0 ${DIM_OVERLAY_DEFAULT} z-[70]`}
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
                        'fixed inset-0 z-[80] flex flex-col overflow-hidden bg-surface shadow-2xl focus:outline-none',
                        'sm:inset-x-6 sm:inset-y-8 sm:mx-auto sm:max-w-5xl sm:rounded-2xl sm:border sm:border-line'
                    )}>
                    <header className="flex items-start justify-between gap-3 border-b border-line bg-surface-elevated px-4 py-4 sm:px-5">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <History aria-hidden="true" className="h-5 w-5 shrink-0 text-content-hint" />
                                <Dialog.Title className="text-base font-semibold text-content sm:text-lg">
                                    수정 이력
                                </Dialog.Title>
                            </div>
                            <Dialog.Description className="mt-1 text-xs leading-relaxed text-content-secondary sm:text-sm">
                                내용 수정 직전 저장본을 확인하고 복원할 수 있습니다
                            </Dialog.Description>
                        </div>
                        <IconButton
                            size="sm"
                            aria-label="수정 이력 닫기"
                            title="수정 이력 닫기"
                            onClick={onClose}>
                            <X className="h-5 w-5" />
                        </IconButton>
                    </header>

                    <div className="grid min-h-0 flex-1 grid-rows-[minmax(11rem,38vh)_minmax(0,1fr)] md:grid-cols-[20rem_minmax(0,1fr)] md:grid-rows-1">
                        <aside className="min-h-0 overflow-y-auto border-b border-line bg-surface-subtle md:border-b-0 md:border-r">
                            {isLoading ? (
                                <div className="flex h-full min-h-44 items-center justify-center" role="status">
                                    <Loader2 className="h-5 w-5 animate-spin text-content-hint" />
                                    <span className="sr-only">수정 이력 불러오는 중</span>
                                </div>
                            ) : errorMessage ? (
                                <div className="flex h-full min-h-44 flex-col items-center justify-center gap-3 p-5 text-center">
                                    <AlertTriangle className="h-5 w-5 text-danger" aria-hidden="true" />
                                    <p className="text-sm text-content-secondary">{errorMessage}</p>
                                    <Button variant="secondary" onClick={() => void loadFirstPage()}>
                                        다시 시도
                                    </Button>
                                </div>
                            ) : revisions.length === 0 ? (
                                <div className="flex h-full min-h-44 flex-col items-center justify-center gap-2 p-5 text-center">
                                    <History className="h-6 w-6 text-content-hint" aria-hidden="true" />
                                    <p className="text-sm font-medium text-content">아직 수정 이력이 없습니다</p>
                                    <p className="text-xs leading-relaxed text-content-secondary">
                                        발행된 글의 내용을 수정하면 직전 저장본이 여기에 남습니다.
                                    </p>
                                </div>
                            ) : (
                                <div className="p-2" aria-label="수정본 목록">
                                    {revisions.map(revision => {
                                        const isSelected = revision.id === selectedRevisionId;
                                        return (
                                            <button
                                                key={revision.id}
                                                type="button"
                                                aria-current={isSelected ? 'true' : undefined}
                                                onClick={() => void loadDetail(revision.id)}
                                                className={cx(
                                                    'mb-1 w-full rounded-xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/30',
                                                    isSelected
                                                        ? 'border-action/40 bg-surface-elevated shadow-sm'
                                                        : 'border-transparent hover:border-line hover:bg-surface-elevated'
                                                )}>
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="min-w-0 truncate text-sm font-semibold text-content">
                                                        {revision.title || '제목 없음'}
                                                    </span>
                                                    <span className="shrink-0 rounded-full bg-line-light px-2 py-0.5 text-[11px] font-medium text-content-secondary">
                                                        {changeTypeLabels[revision.changeType]}
                                                    </span>
                                                </div>
                                                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-content-secondary">
                                                    {revision.contentExcerpt || '본문 미리보기 없음'}
                                                </p>
                                                <span className="mt-2 flex items-center gap-1 text-[11px] text-content-hint">
                                                    <Clock className="h-3 w-3" aria-hidden="true" />
                                                    {formatDateTime(revision.createdDate)}
                                                </span>
                                            </button>
                                        );
                                    })}
                                    {currentPage < lastPage && (
                                        <Button
                                            variant="ghost"
                                            fullWidth
                                            isLoading={isLoadingMore}
                                            onClick={() => void handleLoadMore()}>
                                            더 보기
                                        </Button>
                                    )}
                                </div>
                            )}
                        </aside>

                        <main className="min-h-0 overflow-y-auto bg-surface p-4 sm:p-5">
                            {isLoadingDetail ? (
                                <div className="flex min-h-48 items-center justify-center" role="status">
                                    <Loader2 className="h-5 w-5 animate-spin text-content-hint" />
                                    <span className="sr-only">수정본 내용 불러오는 중</span>
                                </div>
                            ) : selectedRevision ? (
                                <article className="mx-auto max-w-2xl">
                                    <div className="border-b border-line pb-4">
                                        <p className="text-xs text-content-hint">
                                            {formatDateTime(selectedRevision.createdDate)} · {changeTypeLabels[selectedRevision.changeType]}
                                        </p>
                                        <h3 className="mt-2 break-words text-xl font-bold text-content sm:text-2xl">
                                            {selectedRevision.title || '제목 없음'}
                                        </h3>
                                        {selectedRevision.subtitle && (
                                            <p className="mt-2 break-words text-sm text-content-secondary">
                                                {selectedRevision.subtitle}
                                            </p>
                                        )}
                                        {selectedRevision.tags.length > 0 && (
                                            <div className="mt-3 flex flex-wrap gap-1.5" aria-label="수정본 태그">
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
                                            <h4 className="text-xs font-semibold uppercase tracking-wide text-content-hint">설명</h4>
                                            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-content-secondary">
                                                {selectedRevision.description}
                                            </p>
                                        </section>
                                    )}

                                    <section className="py-4">
                                        <h4 className="text-xs font-semibold uppercase tracking-wide text-content-hint">본문</h4>
                                        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-content">
                                            {selectedRevision.contentText || '본문 내용이 없습니다.'}
                                        </p>
                                    </section>

                                    {!selectedRevision.canRestore && (
                                        <div className="flex gap-2 rounded-xl border border-line bg-surface-subtle p-3 text-sm text-content-secondary">
                                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                            <p>이전 형식으로 저장된 이력은 원문 형식을 확정할 수 없어 조회만 지원합니다.</p>
                                        </div>
                                    )}
                                </article>
                            ) : revisions.length > 0 ? (
                                <div className="flex min-h-48 items-center justify-center text-sm text-content-secondary">
                                    확인할 수정본을 선택해주세요.
                                </div>
                            ) : null}
                        </main>
                    </div>

                    <footer className="border-t border-line bg-surface-elevated px-4 py-3 sm:px-5">
                        {hasVersionConflict && (
                            <div className="mb-3 flex gap-2 rounded-xl border border-danger/30 bg-danger-surface p-3 text-sm text-danger" role="alert">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                <p>이 페이지를 연 뒤 포스트가 변경되었습니다. 새로고침한 뒤 수정 이력을 다시 확인해주세요.</p>
                            </div>
                        )}
                        {isConfirmingRestore && selectedRevision && (
                            <div className="mb-3 rounded-xl border border-line bg-surface-subtle p-3 text-sm leading-relaxed text-content-secondary">
                                <strong className="text-content">‘{selectedRevision.title || '제목 없음'}’ 수정본으로 복원할까요?</strong>
                                <p className="mt-1">현재 내용은 복원 직전 수정본으로 남습니다. URL과 발행·공개·댓글 설정은 바뀌지 않습니다.</p>
                            </div>
                        )}
                        <div className="flex items-center justify-end gap-2">
                            {isConfirmingRestore ? (
                                <>
                                    <Button
                                        variant="secondary"
                                        size="lg"
                                        disabled={isRestoring}
                                        onClick={() => setIsConfirmingRestore(false)}>
                                        취소
                                    </Button>
                                    <Button
                                        size="lg"
                                        isLoading={isRestoring}
                                        disabled={!selectedRevision?.canRestore || hasVersionConflict}
                                        leftIcon={<RotateCcw className="h-4 w-4" />}
                                        onClick={() => void handleRestore()}>
                                        복원
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button variant="secondary" size="lg" onClick={onClose}>닫기</Button>
                                    <Button
                                        size="lg"
                                        disabled={!selectedRevision?.canRestore || hasVersionConflict}
                                        leftIcon={<RotateCcw className="h-4 w-4" />}
                                        onClick={() => setIsConfirmingRestore(true)}>
                                        이 수정본으로 복원
                                    </Button>
                                </>
                            )}
                        </div>
                    </footer>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

export default PostRevisionDialog;
