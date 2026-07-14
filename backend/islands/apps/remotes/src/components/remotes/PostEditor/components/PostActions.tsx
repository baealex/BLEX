import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { Button } from '@blex/ui/button';
import { FloatingBottomBar } from '@blex/ui/floating-bottom-bar';
import { IconButton } from '@blex/ui/icon-button';
import {
    Eye,
    FileText,
    History,
    Loader2,
    Save,
    Send,
    SlidersHorizontal
} from '@blex/ui/icons';

interface PostActionsProps {
    mode: 'new' | 'edit' | 'draft';
    isSaving: boolean;
    isSubmitting: boolean;
    isMediaUploading?: boolean;
    isSubmitDisabled?: boolean;
    lastSaved: Date | null;
    hasSaveError?: boolean;
    hasPendingChanges?: boolean;
    autoSaveCountdown?: number | null;
    onManualSave: () => void;
    onSubmit: () => void;
    onOpenDrafts?: () => void;
    onPreview?: (event: MouseEvent<HTMLButtonElement>) => void;
    isPreviewing?: boolean;
    onOpenHistory?: (event: MouseEvent<HTMLButtonElement>) => void;
    onOpenSettings?: () => void;
    submitLabel?: string;
}

const formatTimeSince = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return '방금 저장됨';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}분 전 저장됨`;
    const hours = Math.floor(minutes / 60);
    return `${hours}시간 전 저장됨`;
};

const PostActions = ({
    mode,
    isSaving,
    isSubmitting,
    isMediaUploading = false,
    isSubmitDisabled = false,
    lastSaved,
    hasSaveError = false,
    hasPendingChanges = false,
    autoSaveCountdown = null,
    onManualSave,
    onSubmit,
    onOpenDrafts,
    onPreview,
    isPreviewing = false,
    onOpenHistory,
    onOpenSettings,
    submitLabel
}: PostActionsProps) => {
    const isEdit = mode === 'edit';
    const actionLabel = submitLabel || (isEdit ? '수정' : '발행');
    const isBusy = isSubmitting || isSaving || isMediaUploading;
    const [, setTick] = useState(0);

    // Update time display every 30 seconds
    useEffect(() => {
        if (!lastSaved) return;
        const timer = setInterval(() => setTick(t => t + 1), 30000);
        return () => clearInterval(timer);
    }, [lastSaved]);

    return (
        <FloatingBottomBar>
            {/* Temp Posts */}
            {!isEdit && onOpenDrafts && (
                <IconButton
                    onClick={onOpenDrafts}
                    rounded="full"
                    className="shrink-0"
                    aria-label="임시 포스트"
                    title="임시 포스트">
                    <FileText className="w-5 h-5" />
                </IconButton>
            )}

            {/* Rendered Preview */}
            {onPreview && (
                <IconButton
                    onClick={onPreview}
                    disabled={isBusy || isPreviewing}
                    rounded="full"
                    className="shrink-0"
                    aria-label="포스트 미리보기"
                    aria-busy={isPreviewing}
                    title="포스트 미리보기">
                    {isPreviewing ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                        <Eye className="h-5 w-5" />
                    )}
                </IconButton>
            )}

            {/* Revision History */}
            {onOpenHistory && (
                <IconButton
                    onClick={onOpenHistory}
                    disabled={isBusy}
                    rounded="full"
                    className="shrink-0"
                    aria-label="수정 이력"
                    title="수정 이력">
                    <History className="h-5 w-5" />
                </IconButton>
            )}

            {/* Settings */}
            {onOpenSettings && (
                <IconButton
                    onClick={onOpenSettings}
                    rounded="full"
                    className="shrink-0"
                    aria-label="게시 설정"
                    title="게시 설정"
                    data-tour="post-settings">
                    <SlidersHorizontal className="w-5 h-5" />
                </IconButton>
            )}

            {/* Save Section */}
            {!isEdit && (
                <>
                    <div className="mx-1 h-8 w-px shrink-0 bg-line/50" />

                    {/* Autosave Status */}
                    <div
                        className="hidden shrink-0 items-center gap-1.5 px-1 text-xs text-content-hint sm:flex"
                        aria-live="polite"
                        data-tour="post-autosave">
                        {isSaving ? (
                            <>
                                <div className="w-1.5 h-1.5 rounded-full bg-line-strong animate-pulse" />
                                <span className="text-content-secondary">저장 중...</span>
                            </>
                        ) : hasSaveError ? (
                            <>
                                <div className="w-1.5 h-1.5 rounded-full bg-danger" />
                                <span className="text-danger">저장 실패</span>
                            </>
                        ) : autoSaveCountdown !== null ? (
                            <>
                                <div className="w-1.5 h-1.5 rounded-full bg-line-strong animate-pulse" />
                                <span className="text-content-secondary tabular-nums">{autoSaveCountdown}초 후 저장</span>
                            </>
                        ) : hasPendingChanges ? (
                            <>
                                <div className="w-1.5 h-1.5 rounded-full bg-line-strong animate-pulse" />
                                <span className="text-content-secondary">저장 대기 중</span>
                            </>
                        ) : lastSaved ? (
                            <>
                                <div className="w-1.5 h-1.5 rounded-full bg-action-hover" />
                                <span>{formatTimeSince(lastSaved)}</span>
                            </>
                        ) : (
                            <>
                                <div className="w-1.5 h-1.5 rounded-full bg-line-strong" />
                                <span>자동 저장 켜짐</span>
                            </>
                        )}
                    </div>

                    {/* Manual Save Button */}
                    <IconButton
                        size="sm"
                        rounded="full"
                        onClick={onManualSave}
                        disabled={isBusy}
                        className="shrink-0 sm:hidden"
                        aria-label="임시 저장"
                        title="임시 저장">
                        <Save className="h-4 w-4" />
                    </IconButton>
                    <button
                        type="button"
                        onClick={onManualSave}
                        disabled={isBusy}
                        className="hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-content-secondary transition-all hover:bg-surface-subtle hover:text-content active:scale-95 disabled:opacity-50 sm:flex motion-interaction"
                        title="임시 저장">
                        <span>임시 저장</span>
                    </button>
                </>
            )}

            {/* Publish/Update Button */}
            <Button
                onClick={onSubmit}
                disabled={isBusy || isSubmitDisabled}
                variant="primary"
                className="min-h-11! shrink-0 !rounded-full"
                leftIcon={<Send className="w-4 h-4" />}
                data-tour="post-publish">
                {actionLabel}
            </Button>
        </FloatingBottomBar>
    );
};

export default PostActions;
