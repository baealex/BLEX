import React from 'react';

const EditorHelpText: React.FC = () => {
    return (
        <div className="bg-gray-50 p-6 mb-6 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <i className="fa fa-magic text-gray-600" />
                </div>
                <div className="flex-1">
                    <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        ✨ 에디터 사용법
                    </h3>
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
            </div>
        </div>
    );
};

export default EditorHelpText;
