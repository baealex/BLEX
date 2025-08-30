import React from 'react';

interface AutoSaveStatusProps {
    isSaving: boolean;
    lastSaved: Date | null;
    nextSaveIn: number;
    saveProgress: number;
}

const AutoSaveStatus: React.FC<AutoSaveStatusProps> = ({
    isSaving,
    lastSaved,
    nextSaveIn,
    saveProgress
}) => {
    return (
        <div className="flex flex-col gap-2 min-w-0">
            {/* Status text */}
            <div className="flex items-center gap-2 text-sm">
                {isSaving ? (
                    <div className="flex items-center gap-2 text-blue-600">
                        <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                        <span className="font-medium">자동저장 중...</span>
                    </div>
                ) : lastSaved ? (
                    <div className="flex items-center gap-2 text-green-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="font-medium">
                            {lastSaved.toLocaleTimeString('ko-KR', {
                                hour: '2-digit',
                                minute: '2-digit'
                            })} 자동저장됨
                        </span>
                    </div>
                ) : nextSaveIn > 0 ? (
                    <div className="flex items-center gap-2 text-slate-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>
                            {Math.ceil(nextSaveIn / 1000)}초 후 자동저장
                        </span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-slate-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>자동저장 대기 중</span>
                    </div>
                )}
            </div>

            {/* Progress bar */}
            {(nextSaveIn > 0 || saveProgress > 0) && !isSaving && (
                <div className="w-full max-w-48">
                    <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-linear"
                            style={{ width: `${Math.max(1, saveProgress)}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default AutoSaveStatus;
