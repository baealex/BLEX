import { useState } from 'react';

const EditorHelpText = () => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="bg-surface-subtle mb-6 rounded-xl border border-line-light shadow-sm overflow-hidden">
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-line-light transition-colors">
                <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-surface rounded-full flex items-center justify-center border border-line-light">
                        <i className="fa fa-magic text-content-secondary text-sm" />
                    </div>
                    <h3 className="text-sm font-semibold text-content flex items-center gap-2">
                        ✨ 에디터 사용법
                    </h3>
                </div>
                <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} text-content-hint text-sm transition-transform`} />
            </button>

            {isExpanded && (
                <div className="px-6 pb-4 pt-2 border-t border-line">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3 text-sm text-content-secondary">
                            <div className="flex items-center gap-2">
                                <kbd className="px-2 py-1 text-xs font-medium bg-action text-content-inverted rounded shadow-sm">/</kbd>
                                <span className="font-medium text-content">슬래시 명령어</span>
                            </div>
                            <span className="text-content-hint">→</span>
                            <span>제목, 리스트, 코드블록 등을 쉽게 추가해요</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-content-secondary">
                            <div className="flex items-center gap-2">
                                <i className="fa fa-mouse-pointer text-content-hint w-4" />
                                <span className="font-medium text-content">텍스트 선택</span>
                            </div>
                            <span className="text-content-hint">→</span>
                            <span>볼드, 이탤릭, 하이라이트 등 서식을 적용해요</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-content-secondary">
                            <div className="flex items-center gap-2">
                                <i className="fa fa-upload text-content-hint w-4" />
                                <span className="font-medium text-content">드래그 & 드롭</span>
                            </div>
                            <span className="text-content-hint">→</span>
                            <span>이미지를 바로 끌어다 놓으면 자동으로 업로드됩니다</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EditorHelpText;
