import React from 'react';

interface DangerZoneProps {
    isSubmitting: boolean;
    onDelete: () => void;
}

const DangerZone: React.FC<DangerZoneProps> = ({ isSubmitting, onDelete }) => {
    return (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 sm:p-6">
            <h3 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-gray-700 mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                위험 구역
            </h3>
            <button
                type="button"
                onClick={onDelete}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 sm:py-3 bg-black text-white rounded-lg hover:bg-gray-900 transition-colors text-sm sm:text-base disabled:opacity-50">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                게시글 삭제
            </button>
        </div>
    );
};

export default DangerZone;