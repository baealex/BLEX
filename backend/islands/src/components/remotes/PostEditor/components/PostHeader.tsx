import React, { useState, useEffect } from 'react';
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
    onOpenSettings?: () => void;
    onOpenCommandPalette?: () => void;
    topOnly?: boolean;
    bottomOnly?: boolean;
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
    onOpenTempPosts,
    onOpenSettings,
    topOnly = false,
    bottomOnly = false
}) => {
    const isEdit = mode === 'edit';
    const [isScrolled, setIsScrolled] = useState(false);

    // Add scroll listener to switch between top and bottom
    useEffect(() => {
        if (bottomOnly) {
            const handleScroll = () => {
                setIsScrolled(window.scrollY > 100);
            };

            window.addEventListener('scroll', handleScroll);
            return () => window.removeEventListener('scroll', handleScroll);
        }
    }, [bottomOnly]);

    const headerContent = (
        <div className="flex items-center justify-between gap-4">
            {/* Left side - Auto-save status */}
            <div className="flex items-center gap-3">
                {!isEdit && (
                    <AutoSaveStatus
                        isSaving={isSaving}
                        lastSaved={lastSaved}
                        nextSaveIn={nextSaveIn}
                        saveProgress={saveProgress}
                    />
                )}
            </div>

            {/* Right side - Actions */}
            <div className="flex items-center gap-2">
                {/* Temp Posts */}
                {!isEdit && onOpenTempPosts && (
                    <button
                        type="button"
                        onClick={onOpenTempPosts}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors group"
                        title="임시 저장 글">
                        <svg className="w-4 h-4 text-gray-600 group-hover:text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </button>
                )}

                {/* Settings */}
                {onOpenSettings && (
                    <button
                        type="button"
                        onClick={onOpenSettings}
                        className="flex items-center gap-1.5 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors text-sm text-gray-700 font-medium"
                        title="게시 설정">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                        </svg>
                        <span className="hidden sm:inline">설정</span>
                    </button>
                )}

                {/* Manual Save */}
                {!isEdit && (
                    <button
                        type="button"
                        onClick={onManualSave}
                        disabled={isSubmitting || isSaving}
                        className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <span className="hidden sm:inline">저장</span>
                    </button>
                )}

                {/* Publish/Update */}
                <button
                    type="button"
                    onClick={onSubmit}
                    disabled={isSubmitting || isSaving}
                    className="flex items-center gap-1.5 px-5 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    <span>{isEdit ? '수정' : '게시'}</span>
                </button>
            </div>
        </div>
    );

    const renderTopHeader = () => (
        <div className="bg-transparent py-4">
            {headerContent}
        </div>
    );

    const renderBottomHeader = () => (
        <div
            className={`sticky bottom-0 ${bottomOnly ? 'mt-4' : ''} bg-white border-t border-gray-200 rounded-2xl shadow-sm transition-opacity duration-300 ${
                isScrolled ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            style={{ zIndex: 30 }}>
            <div className="max-w-4xl mx-auto px-4 py-3">
                {headerContent}
            </div>
        </div>
    );

    if (topOnly) {
        return renderTopHeader();
    }

    if (bottomOnly) {
        return renderBottomHeader();
    }

    return (
        <>
            {renderTopHeader()}
            {renderBottomHeader()}
        </>
    );
};

export default PostHeader;
