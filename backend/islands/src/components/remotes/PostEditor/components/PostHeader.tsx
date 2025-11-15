import React from 'react';
import AutoSaveStatus from './AutoSaveStatus';

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
}

const PostHeader: React.FC<PostHeaderProps> = ({
    mode,
    isSaving,
    isSubmitting,
    lastSaved,
    nextSaveIn = 0,
    saveProgress = 0,
    onManualSave,
    onSubmit,
    onOpenTempPosts
}) => {
    const isEdit = mode === 'edit';

    return (
        <header className="bg-white rounded-xl shadow-sm border border-solid border-gray-200 mb-4 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                    <h1 className="text-base sm:text-lg font-semibold text-gray-900">
                        {isEdit ? '수정' : mode === 'temp' ? '이어서 작성' : '새 글'}
                    </h1>
                    {/* Auto-save status - inline with title */}
                    {!isEdit && (
                        <AutoSaveStatus
                            isSaving={isSaving}
                            lastSaved={lastSaved}
                            nextSaveIn={nextSaveIn}
                            saveProgress={saveProgress}
                        />
                    )}
                </div>
                <div className="flex gap-2">
                    {!isEdit && onOpenTempPosts && (
                        <button
                            type="button"
                            onClick={onOpenTempPosts}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-solid border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                            aria-label="임시 저장 글 목록">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="hidden sm:inline">임시글</span>
                        </button>
                    )}
                    {!isEdit && (
                        <button
                            type="button"
                            onClick={onManualSave}
                            disabled={isSubmitting || isSaving}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-solid border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <span className="hidden sm:inline">임시저장</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={onSubmit}
                        disabled={isSubmitting || isSaving}
                        className="flex items-center justify-center gap-1.5 px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        <span>{isEdit ? '수정' : '게시'}</span>
                    </button>
                </div>
            </div>
        </header>
    );
};

export default PostHeader;
