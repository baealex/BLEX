import React from 'react';

interface PostSettingsProps {
    formData: {
        hide: boolean;
        notice: boolean;
        advertise: boolean;
    };
    onChange: (field: string, value: boolean) => void;
}

const PostSettings: React.FC<PostSettingsProps> = ({ formData, onChange }) => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
            <h3 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-slate-700 mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                게시글 설정
            </h3>

            <div className="space-y-4">
                <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                        type="checkbox"
                        id="hide"
                        name="hide"
                        checked={formData.hide}
                        onChange={(e) => onChange('hide', e.target.checked)}
                        className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 mt-0.5"
                    />
                    <div>
                        <div className="font-medium text-slate-700 group-hover:text-slate-900 text-sm sm:text-base">비공개</div>
                        <div className="text-xs sm:text-sm text-slate-500">본인만 볼 수 있습니다</div>
                    </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                        type="checkbox"
                        id="notice"
                        name="notice"
                        checked={formData.notice}
                        onChange={(e) => onChange('notice', e.target.checked)}
                        className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 mt-0.5"
                    />
                    <div>
                        <div className="font-medium text-slate-700 group-hover:text-slate-900 text-sm sm:text-base">공지사항으로 고정</div>
                        <div className="text-xs sm:text-sm text-slate-500">블로그 상단에 고정됩니다</div>
                    </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                        type="checkbox"
                        id="advertise"
                        name="advertise"
                        checked={formData.advertise}
                        onChange={(e) => onChange('advertise', e.target.checked)}
                        className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 mt-0.5"
                    />
                    <div>
                        <div className="font-medium text-slate-700 group-hover:text-slate-900 text-sm sm:text-base">광고 표시</div>
                        <div className="text-xs sm:text-sm text-slate-500">이 게시글에 광고를 표시합니다</div>
                    </div>
                </label>
            </div>
        </div>
    );
};

export default PostSettings;