import { useEffect, useState } from 'react';
import { Dialog } from '@blex/ui/dialog';
import { IconButton } from '@blex/ui/icon-button';
import { Eye, Loader2, RotateCw, X } from '@blex/ui/icons';
import { DIM_OVERLAY_DEFAULT, ENTRANCE_DURATION } from '@blex/ui/design-tokens';
import { cx } from '~/lib/classnames';

type PreviewViewport = 'desktop' | 'mobile';

interface PostPreviewDialogProps {
    isOpen: boolean;
    previewUrl: string | null;
    returnFocusTo?: HTMLButtonElement | null;
    onClose: () => void;
}

const viewportOptions: Array<{ value: PreviewViewport; label: string }> = [
    {
        value: 'desktop',
        label: '데스크톱'
    },
    {
        value: 'mobile',
        label: '모바일'
    }
];

const PostPreviewDialog = ({
    isOpen,
    previewUrl,
    returnFocusTo,
    onClose
}: PostPreviewDialogProps) => {
    const [viewport, setViewport] = useState<PreviewViewport>('desktop');
    const [refreshKey, setRefreshKey] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!isOpen || !previewUrl) return;
        setIsLoading(true);
    }, [isOpen, previewUrl]);

    const handleRefresh = () => {
        setIsLoading(true);
        setRefreshKey(current => current + 1);
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Dialog.Portal>
                <Dialog.Overlay
                    className={`fixed inset-0 ${DIM_OVERLAY_DEFAULT} z-[70] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0`}
                />
                <Dialog.Content
                    onCloseAutoFocus={(event) => {
                        if (!returnFocusTo?.isConnected) return;
                        event.preventDefault();
                        returnFocusTo.focus({ preventScroll: true });
                    }}
                    className={cx(
                        'fixed inset-0 z-[80] flex flex-col overflow-hidden bg-surface shadow-2xl focus:outline-none',
                        'sm:inset-4 sm:rounded-2xl sm:border sm:border-line',
                        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
                        `${ENTRANCE_DURATION} ease-in-out motion-reduce:animate-none motion-reduce:transition-none`
                    )}>
                    <div className="flex flex-col gap-3 border-b border-line bg-surface-elevated px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <Eye className="h-5 w-5 shrink-0 text-content-hint" />
                                <Dialog.Title className="truncate text-base font-semibold text-content sm:text-lg">
                                    포스트 미리보기
                                </Dialog.Title>
                            </div>
                            <Dialog.Description className="mt-1 text-xs text-content-secondary">
                                마지막으로 저장된 임시 포스트를 실제 화면으로 표시합니다
                            </Dialog.Description>
                        </div>

                        <div className="flex items-center justify-between gap-2 sm:justify-end">
                            <div
                                className="inline-flex rounded-xl border border-line bg-surface-subtle p-1"
                                role="group"
                                aria-label="미리보기 화면 크기">
                                {viewportOptions.map((option) => {
                                    const isActive = viewport === option.value;
                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            aria-pressed={isActive}
                                            onClick={() => setViewport(option.value)}
                                            className={cx(
                                                'inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-medium transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/30',
                                                isActive
                                                    ? 'bg-surface-elevated text-content shadow-sm'
                                                    : 'text-content-secondary hover:text-content'
                                            )}>
                                            {option.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <IconButton
                                size="sm"
                                aria-label="미리보기 새로고침"
                                title="미리보기 새로고침"
                                onClick={handleRefresh}
                                disabled={!previewUrl || isLoading}>
                                <RotateCw className="h-4 w-4" />
                            </IconButton>
                            <Dialog.Close asChild>
                                <IconButton size="sm" aria-label="미리보기 닫기" title="미리보기 닫기">
                                    <X className="h-5 w-5" />
                                </IconButton>
                            </Dialog.Close>
                        </div>
                    </div>

                    <div className="flex min-h-0 flex-1 justify-center overflow-auto bg-surface-subtle p-2 sm:p-4">
                        {previewUrl && (
                            <div
                                style={viewport === 'mobile' ? { width: 390 } : undefined}
                                className={cx(
                                    'relative h-full min-h-[36rem] overflow-hidden border border-line bg-surface shadow-xl transition-[width,border-radius] duration-200 motion-reduce:transition-none',
                                    viewport === 'mobile'
                                        ? 'max-w-full rounded-2xl'
                                        : 'w-full rounded-xl'
                                )}>
                                {isLoading && (
                                    <div
                                        className="absolute inset-0 z-10 flex items-center justify-center bg-surface"
                                        role="status"
                                        aria-label="미리보기 불러오는 중">
                                        <Loader2 className="h-6 w-6 animate-spin text-content-hint" />
                                    </div>
                                )}
                                <iframe
                                    key={`${previewUrl}:${refreshKey}`}
                                    src={previewUrl}
                                    title="저장된 포스트 렌더링 미리보기"
                                    className="h-full w-full border-0 bg-surface"
                                    sandbox="allow-same-origin allow-scripts"
                                    referrerPolicy="same-origin"
                                    onLoad={() => setIsLoading(false)}
                                />
                            </div>
                        )}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

export default PostPreviewDialog;
