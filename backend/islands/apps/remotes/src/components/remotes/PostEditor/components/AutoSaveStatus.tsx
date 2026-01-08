interface AutoSaveStatusProps {
    isSaving: boolean;
    lastSaved: Date | null;
    nextSaveIn: number;
    saveProgress: number;
}

const AutoSaveStatus = ({
    isSaving,
    lastSaved,
    nextSaveIn,
    saveProgress
}: AutoSaveStatusProps) => {
    const isWaiting = nextSaveIn > 0 && !isSaving;

    return (
        <div className="flex items-center gap-1.5 text-xs text-gray-500 px-3 py-2 bg-gray-50 rounded-lg relative overflow-hidden">
            {/* Progress bar background */}
            {isWaiting && (
                <div
                    className="absolute bottom-0 left-0 h-0.5 bg-gray-300 transition-all duration-300 ease-linear"
                    style={{ width: `${saveProgress}%` }}
                />
            )}

            {isSaving ? (
                <>
                    <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                    <span>저장 중</span>
                </>
            ) : lastSaved ? (
                <>
                    <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>
                        {lastSaved.toLocaleTimeString('ko-KR', {
                            hour: '2-digit',
                            minute: '2-digit'
                        })} 저장됨
                    </span>
                </>
            ) : isWaiting ? (
                <>
                    <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{Math.ceil(nextSaveIn / 1000)}초 후 저장</span>
                </>
            ) : (
                <>
                    <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>대기 중</span>
                </>
            )}
        </div>
    );
};

export default AutoSaveStatus;
