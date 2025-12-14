import { useState } from 'react';

const EditorHelpText = () => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="bg-gray-50 mb-6 rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <i className="fa fa-magic text-gray-600 text-sm" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                        ✨ 에디터 사용법
                    </h3>
                </div>
                <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} text-gray-400 text-sm transition-transform`} />
            </button>

            {isExpanded && (
                <div className="px-6 pb-4 pt-2 border-t border-gray-200">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                                <kbd className="px-2 py-1 text-xs font-medium bg-gray-900 text-white rounded shadow-sm">/</kbd>
                                <span className="font-medium text-gray-700">슬래시 명령어</span>
                            </div>
                            <span className="text-gray-500">→</span>
                            <span>제목, 리스트, 코드블록 등을 쉽게 추가해요</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                                <i className="fa fa-mouse-pointer text-gray-500 w-4" />
                                <span className="font-medium text-gray-700">텍스트 선택</span>
                            </div>
                            <span className="text-gray-500">→</span>
                            <span>볼드, 이탤릭, 하이라이트 등 서식을 적용해요</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                                <i className="fa fa-upload text-gray-500 w-4" />
                                <span className="font-medium text-gray-700">드래그 & 드롭</span>
                            </div>
                            <span className="text-gray-500">→</span>
                            <span>이미지를 바로 끌어다 놓으면 자동으로 업로드됩니다</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EditorHelpText;
