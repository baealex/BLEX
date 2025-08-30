import React from 'react';

interface PostHeaderProps {
    mode: 'new' | 'edit' | 'temp';
    isSaving: boolean;
    isSubmitting: boolean;
    lastSaved: Date | null;
    onManualSave: () => void;
    onSubmit: () => void;
}

const PostHeader: React.FC<PostHeaderProps> = ({
    mode,
    isSaving,
    isSubmitting,
    lastSaved,
    onManualSave,
    onSubmit
}) => {
    const isEdit = mode === 'edit';

    return (
        <header className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 sm:mb-8 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900">
                    {isEdit ? '게시글 수정' : mode === 'temp' ? '임시저장 게시글 작성' : '새 게시글 작성'}
                </h1>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    {/* Auto-save status */}
                    {(isSaving || lastSaved) && (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            {isSaving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                                    <span>저장 중...</span>
                                </>
                            ) : lastSaved ? (
                                <>
                                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>
                                        {lastSaved.toLocaleTimeString('ko-KR', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })} 자동저장됨
                                    </span>
                                </>
                            ) : null}
                        </div>
                    )}

                    {!isEdit && (
                        <button
                            type="button"
                            onClick={onManualSave}
                            disabled={isSubmitting || isSaving}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 w-full sm:w-auto disabled:opacity-50">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            임시저장
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={onSubmit}
                        disabled={isSubmitting || isSaving}
                        className="flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm w-full sm:w-auto disabled:opacity-50">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        {isEdit ? '수정' : '게시'}
                    </button>
                </div>
            </div>
        </header>
    );
};

export default PostHeader;