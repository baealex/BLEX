import {
    IconButton,
    Button,
    FileText,
    SlidersHorizontal,
    Send
} from '@blex/ui';

interface PostActionsProps {
    mode: 'new' | 'edit' | 'temp';
    isSaving: boolean;
    isSubmitting: boolean;
    lastSaved: Date | null;
    hasSaveError?: boolean;
    nextSaveIn?: number;
    saveProgress?: number;
    onManualSave: () => void;
    onSubmit: () => void;
    onOpenTempPosts?: () => void;
    onOpenSettings?: () => void;
}

const PostActions = ({
    mode,
    isSaving,
    isSubmitting,
    lastSaved,
    hasSaveError = false,
    nextSaveIn = 0,
    onManualSave,
    onSubmit,
    onOpenTempPosts,
    onOpenSettings
}: PostActionsProps) => {
    const isEdit = mode === 'edit';

    return (
        <div className="fixed sm:sticky bottom-6 left-0 right-0 z-30 flex justify-center pointer-events-none">
            <div className="pointer-events-auto bg-white/80 backdrop-blur-xl border border-white/20 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-full px-3 py-3 flex items-center gap-2 transform transition-all duration-300 hover:scale-105 hover:shadow-[0_8px_40px_rgb(0,0,0,0.16)]">
                {/* Temp Posts */}
                {!isEdit && onOpenTempPosts && (
                    <IconButton
                        onClick={onOpenTempPosts}
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

                {/* Manual Save */}
                {!isEdit && (
                    <>
                        <div className="w-px h-8 bg-gray-200/50 mx-1" />
                        <button
                            type="button"
                            onClick={onManualSave}
                            disabled={isSubmitting || isSaving}
                            className="flex items-center gap-2 px-2 text-xs text-gray-500"
                            title="임시 저장">
                            {isSaving ? (
                                <>
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                    <span>저장 중...</span>
                                </>
                            ) : hasSaveError ? (
                                <>
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                    <span className="text-red-500">저장 실패</span>
                                </>
                            ) : nextSaveIn > 0 ? (
                                <>
                                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                                    <span>{Math.ceil(nextSaveIn / 1000)}초 후 저장</span>
                                </>
                            ) : lastSaved ? (
                                <>
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                    <span>저장됨</span>
                                </>
                            ) : (
                                <>
                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                                    <span>저장 대기</span>
                                </>
                            )}
                        </button>
                    </>
                )}

                {/* Publish/Update Button */}
                <Button
                    onClick={onSubmit}
                    disabled={isSubmitting || isSaving}
                    variant="primary"
                    size="sm"
                    compact
                    className="!rounded-full"
                    leftIcon={<Send className="w-4 h-4" />}>
                    {isEdit ? '수정' : '게시'}
                </Button>
            </div>
        </div>
    );
};

export default PostActions;
