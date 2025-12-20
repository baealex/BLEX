interface PostHeaderProps {
    mode: 'new' | 'edit' | 'temp';
    isSaving: boolean;
    isSubmitting: boolean;
    lastSaved: Date | null;
    nextSaveIn?: number;
    saveProgress?: number;
    onManualSave: () => void;
    onSubmit: () => void;
    onOpenTempPosts?: () => void;
    onOpenSettings?: () => void;
}

const PostHeader = ({
    mode,
    isSaving,
    isSubmitting,
    lastSaved,
    nextSaveIn = 0,
    saveProgress = 0,
    onManualSave,
    onSubmit,
    onOpenTempPosts,
    onOpenSettings
}: PostHeaderProps) => {
    const isEdit = mode === 'edit';

    const renderBottomHeader = () => (
        <div className="fixed sm:sticky bottom-6 left-0 right-0 z-30 flex justify-center pointer-events-none">
            <div className="pointer-events-auto bg-white/80 backdrop-blur-xl border border-white/20 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-full px-3 py-3 flex items-center gap-2 transform transition-all duration-300 hover:scale-105 hover:shadow-[0_8px_40px_rgb(0,0,0,0.16)]">
                {/* Auto-save status - compact */}
                {(lastSaved || !!saveProgress) && !isEdit && (
                    <div className="flex items-center gap-2 px-2 text-xs text-gray-500">
                        {isSaving ? (
                            <>
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                <span className="hidden sm:inline">저장 중...</span>
                            </>
                        ) : nextSaveIn > 0 ? (
                            <>
                                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                                <span className="hidden sm:inline">{Math.ceil(nextSaveIn / 1000)}초 후 저장</span>
                            </>
                        ) : lastSaved ? (
                            <>
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                <span className="hidden sm:inline">저장됨</span>
                            </>
                        ) : null}
                    </div>
                )}

                {!isEdit && (isSaving || nextSaveIn > 0 || lastSaved) && <div className="w-px h-8 bg-gray-200/50 mx-1" />}

                {/* Temp Posts */}
                {!isEdit && onOpenTempPosts && (
                    <button
                        type="button"
                        onClick={onOpenTempPosts}
                        className="w-10 h-10 flex items-center justify-center rounded-full text-gray-600 hover:text-black hover:bg-gray-100/50 transition-all duration-200"
                        title="임시 저장 글">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </button>
                )}

                {/* Settings */}
                {onOpenSettings && (
                    <button
                        type="button"
                        onClick={onOpenSettings}
                        className="w-10 h-10 flex items-center justify-center rounded-full text-gray-600 hover:text-black hover:bg-gray-100/50 transition-all duration-200"
                        title="게시 설정">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                        </svg>
                    </button>
                )}

                {/* Manual Save */}
                {!isEdit && (
                    <>
                        <div className="w-px h-8 bg-gray-200/50 mx-1" />
                        <button
                            type="button"
                            onClick={onManualSave}
                            disabled={isSubmitting || isSaving}
                            className="px-4 h-10 flex items-center gap-2 rounded-full text-gray-700 hover:text-black hover:bg-gray-100/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <span className="hidden sm:inline">임시 저장</span>
                        </button>
                    </>
                )}

                {/* Publish/Update Button */}
                <button
                    type="button"
                    onClick={onSubmit}
                    disabled={isSubmitting || isSaving}
                    className="px-5 h-10 flex items-center gap-2 rounded-full bg-black text-white hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm shadow-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    <span>{isEdit ? '수정' : '게시'}</span>
                </button>
            </div>
        </div>
    );

    // Always render bottom floating bar only
    return renderBottomHeader();
};

export default PostHeader;
