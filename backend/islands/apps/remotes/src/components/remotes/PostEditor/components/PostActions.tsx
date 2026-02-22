import { useEffect, useState } from 'react';
import {
    IconButton,
    Button,
    FileText,
    SlidersHorizontal,
    Send,
    FLOATING_GLASS_SURFACE
} from '@blex/ui';

interface PostActionsProps {
    mode: 'new' | 'edit' | 'draft';
    isSaving: boolean;
    isSubmitting: boolean;
    lastSaved: Date | null;
    hasSaveError?: boolean;
    hasPendingChanges?: boolean;
    autoSaveCountdown?: number | null;
    onManualSave: () => void;
    onSubmit: () => void;
    onOpenDrafts?: () => void;
    onOpenSettings?: () => void;
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
    lastSaved,
    hasSaveError = false,
    hasPendingChanges = false,
    autoSaveCountdown = null,
    onManualSave,
    onSubmit,
    onOpenDrafts,
    onOpenSettings
}: PostActionsProps) => {
    const isEdit = mode === 'edit';
    const [, setTick] = useState(0);

    // Update time display every 30 seconds
    useEffect(() => {
        if (!lastSaved) return;
        const timer = setInterval(() => setTick(t => t + 1), 30000);
        return () => clearInterval(timer);
    }, [lastSaved]);

    return (
        <div className="fixed sm:sticky bottom-6 left-0 right-0 z-30 flex justify-center pointer-events-none">
            <div className={`pointer-events-auto ${FLOATING_GLASS_SURFACE} rounded-full px-3 py-3 flex items-center gap-2 transform transition-all motion-interaction`}>
                {/* Temp Posts */}
                {!isEdit && onOpenDrafts && (
                    <IconButton
                        onClick={onOpenDrafts}
                        rounded="full"
                        aria-label="임시 저장 글"
                        title="임시 저장 글">
                        <FileText className="w-5 h-5" />
                    </IconButton>
                )}

                {/* Settings */}
                {onOpenSettings && (
                    <IconButton
                        onClick={onOpenSettings}
                        rounded="full"
                        aria-label="게시 설정"
                        title="게시 설정">
                        <SlidersHorizontal className="w-5 h-5" />
                    </IconButton>
                )}

                {/* Save Section */}
                {!isEdit && (
                    <>
                        <div className="w-px h-8 bg-gray-200/50 mx-1" />

                        {/* Autosave Status */}
                        <div className="flex items-center gap-1.5 px-1 text-xs text-gray-400" aria-live="polite">
                            {isSaving ? (
                                <>
                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-pulse" />
                                    <span className="text-gray-500">저장 중...</span>
                                </>
                            ) : hasSaveError ? (
                                <>
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                    <span className="text-red-500">저장 실패</span>
                                </>
                            ) : autoSaveCountdown !== null ? (
                                <>
                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-pulse" />
                                    <span className="text-gray-500 tabular-nums">{autoSaveCountdown}초 후 저장</span>
                                </>
                            ) : hasPendingChanges ? (
                                <>
                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-pulse" />
                                    <span className="text-gray-500">저장 대기 중</span>
                                </>
                            ) : lastSaved ? (
                                <>
                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-700" />
                                    <span>{formatTimeSince(lastSaved)}</span>
                                </>
                            ) : (
                                <>
                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                                    <span>변경 사항 없음</span>
                                </>
                            )}
                        </div>

                        {/* Manual Save Button */}
                        <button
                            type="button"
                            onClick={onManualSave}
                            disabled={isSubmitting || isSaving}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 active:scale-95 rounded-full transition-all motion-interaction disabled:opacity-50"
                            title="임시 저장">
                            <span>임시 저장</span>
                        </button>
                    </>
                )}

                {/* Publish/Update Button */}
                <Button
                    onClick={onSubmit}
                    disabled={isSubmitting || isSaving}
                    variant="primary"
                    className="!rounded-full"
                    leftIcon={<Send className="w-4 h-4" />}>
                    {isEdit ? '수정' : '게시'}
                </Button>
            </div>
        </div>
    );
};

export default PostActions;
