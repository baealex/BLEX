import {
    IconButton,
    Button,
    FileText,
    SlidersHorizontal,
    Send
} from '@blex/ui';

interface PostActionsProps {
    mode: 'new' | 'edit' | 'draft';
    isSaving: boolean;
    isSubmitting: boolean;
    lastSaved: Date | null;
    hasSaveError?: boolean;
    onManualSave: () => void;
    onSubmit: () => void;
    onOpenDrafts?: () => void;
    onOpenSettings?: () => void;
}

const PostActions = ({
    mode,
    isSaving,
    isSubmitting,
    lastSaved,
    hasSaveError = false,
    onManualSave,
    onSubmit,
    onOpenDrafts,
    onOpenSettings
}: PostActionsProps) => {
    const isEdit = mode === 'edit';

    return (
        <div className="fixed sm:sticky bottom-6 left-0 right-0 z-30 flex justify-center pointer-events-none">
            <div className="pointer-events-auto bg-white/80 backdrop-blur-xl border border-white/20 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-full px-3 py-3 flex items-center gap-2 transform transition-all duration-300 hover:scale-105 hover:shadow-[0_8px_40px_rgb(0,0,0,0.16)]">
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
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                    <span>자동 저장 중...</span>
                                </>
                            ) : hasSaveError ? (
                                <>
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                    <span className="text-red-500">자동 저장 실패</span>
                                </>
                            ) : lastSaved ? (
                                <>
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                    <span>자동 저장됨</span>
                                </>
                            ) : null}
                        </div>

                        {/* Manual Save Button */}
                        <button
                            type="button"
                            onClick={onManualSave}
                            disabled={isSubmitting || isSaving}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
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
