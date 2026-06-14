import { useEffect, useState } from 'react';
import { Button } from '@blex/ui/button';
import { FloatingBottomBar } from '@blex/ui/floating-bottom-bar';
import { IconButton } from '@blex/ui/icon-button';
import { FileText, Send, SlidersHorizontal } from '@blex/ui/icons';

interface PostActionsProps {
    mode: 'new' | 'edit' | 'draft';
    isSaving: boolean;
    isSubmitting: boolean;
    isMediaUploading?: boolean;
    lastSaved: Date | null;
    hasSaveError?: boolean;
    hasPendingChanges?: boolean;
    autoSaveCountdown?: number | null;
    onManualSave: () => void;
    onSubmit: () => void;
    onOpenDrafts?: () => void;
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
    lastSaved,
    hasSaveError = false,
    hasPendingChanges = false,
    autoSaveCountdown = null,
    onManualSave,
    onSubmit,
    onOpenDrafts,
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
                    aria-label="임시 포스트"
                    title="임시 포스트">
                    <FileText className="w-5 h-5" />
                </IconButton>
            )}

            {/* Settings */}
            {onOpenSettings && (
                <IconButton
                    onClick={onOpenSettings}
                    rounded="full"
                    aria-label="게시 설정"
                    title="게시 설정"
                    data-tour="post-settings">
                    <SlidersHorizontal className="w-5 h-5" />
                </IconButton>
            )}

            {/* Save Section */}
            {!isEdit && (
                <>
                    <div className="w-px h-8 bg-line/50 mx-1" />

                    {/* Autosave Status */}
                    <div
                        className="flex items-center gap-1.5 px-1 text-xs text-content-hint"
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
                    <button
                        type="button"
                        onClick={onManualSave}
                        disabled={isBusy}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-content-secondary hover:text-content hover:bg-surface-subtle active:scale-95 rounded-full transition-all motion-interaction disabled:opacity-50"
                        title="임시 저장">
                        <span>임시 저장</span>
                    </button>
                </>
            )}

            {/* Publish/Update Button */}
            <Button
                onClick={onSubmit}
                disabled={isBusy}
                variant="primary"
                className="!rounded-full"
                leftIcon={<Send className="w-4 h-4" />}
                data-tour="post-publish">
                {actionLabel}
            </Button>
        </FloatingBottomBar>
    );
};

export default PostActions;
