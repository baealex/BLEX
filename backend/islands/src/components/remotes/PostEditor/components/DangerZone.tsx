import React, { useState } from 'react';
import { Button } from '~/components/shared';

interface DangerZoneProps {
    isSubmitting: boolean;
    onDelete: () => void;
}

const DangerZone: React.FC<DangerZoneProps> = ({ isSubmitting, onDelete }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="bg-white border-2 border-red-200 rounded-2xl overflow-hidden">
            {/* Header - Collapsible */}
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-5 bg-red-50 hover:bg-red-100 transition-colors group">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-red-100 rounded-full group-hover:bg-red-200 transition-colors">
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <div className="text-left">
                        <h3 className="text-base font-semibold text-red-900">위험 구역</h3>
                        <p className="text-xs text-red-600">돌이킬 수 없는 작업입니다</p>
                    </div>
                </div>
                <svg
                    className={`w-5 h-5 text-red-600 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="p-5 border-t-2 border-red-200 bg-white">
                    {/* Warning Message */}
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="flex-1">
                                <h4 className="text-sm font-semibold text-red-900 mb-1">게시글 완전 삭제</h4>
                                <p className="text-xs text-red-700 leading-relaxed">
                                    이 작업은 되돌릴 수 없습니다. 게시글과 관련된 모든 데이터가 영구적으로 삭제됩니다.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Delete Button */}
                    <Button
                        type="button"
                        onClick={onDelete}
                        disabled={isSubmitting}
                        variant="danger"
                        size="md"
                        fullWidth>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        게시글 영구 삭제
                    </Button>
                </div>
            )}
        </div>
    );
};

export default DangerZone;
