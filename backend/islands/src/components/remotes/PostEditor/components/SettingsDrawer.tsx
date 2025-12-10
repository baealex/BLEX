import React, { useState } from 'react';

interface Series {
    id: string;
    name: string;
}

interface SettingsDrawerProps {
    isOpen: boolean;
    onClose: () => void;

    // Form data
    isEdit: boolean;
    url: string;
    metaDescription: string;
    selectedSeries: { id: string; name: string };
    seriesList: Series[];
    formData: {
        hide: boolean;
        notice: boolean;
        advertise: boolean;
    };

    // Handlers
    onUrlChange: (url: string) => void;
    onMetaDescriptionChange: (description: string) => void;
    onSeriesChange: (series: { id: string; name: string }) => void;
    onFormDataChange: (field: string, value: boolean) => void;
}

const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
    isOpen,
    onClose,
    isEdit,
    url,
    metaDescription,
    selectedSeries,
    seriesList,
    formData,
    onUrlChange,
    onMetaDescriptionChange,
    onSeriesChange,
    onFormDataChange
}) => {
    const [isSeriesDropdownOpen, setIsSeriesDropdownOpen] = useState(false);

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity duration-300"
                onClick={onClose}
            />

            {/* Drawer */}
            <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                        </svg>
                        <h2 className="text-lg font-semibold text-gray-900">게시 설정</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors group"
                        aria-label="닫기">
                        <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-6">
                    <div className="space-y-8">
                        {/* SEO Section */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                SEO
                            </h3>
                            <div className="space-y-4">
                                {/* URL - Only for new posts */}
                                {!isEdit && (
                                    <div>
                                        <label htmlFor="drawer-url" className="block text-sm font-medium text-gray-700 mb-2">
                                            URL
                                        </label>
                                        <input
                                            type="text"
                                            id="drawer-url"
                                            value={url}
                                            onChange={(e) => onUrlChange(e.target.value)}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-black focus:border-black text-sm transition-all"
                                            placeholder="게시글-url"
                                        />
                                        <p className="text-xs text-gray-400 mt-2">중복 시 자동으로 번호가 추가됩니다</p>
                                    </div>
                                )}

                                <div>
                                    <label htmlFor="drawer-meta" className="block text-sm font-medium text-gray-700 mb-2">
                                        메타 설명
                                    </label>
                                    <textarea
                                        id="drawer-meta"
                                        value={metaDescription}
                                        onChange={(e) => onMetaDescriptionChange(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-black focus:border-black resize-none text-sm transition-all"
                                        rows={4}
                                        maxLength={150}
                                        placeholder="검색 엔진을 위한 설명을 입력하세요..."
                                    />
                                    <div className="flex items-center justify-between mt-2">
                                        <p className="text-xs text-gray-400">검색 결과에 표시되는 설명입니다</p>
                                        <p className={`text-xs font-medium ${metaDescription.length > 140 ? 'text-orange-500' : 'text-gray-400'}`}>
                                            {metaDescription.length}/150
                                        </p>
                                    </div>
                                </div>

                                {/* SEO Tips */}
                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                                    <h4 className="text-sm font-medium text-blue-900 mb-2 flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        SEO 팁
                                    </h4>
                                    <ul className="text-xs text-blue-700 space-y-1">
                                        <li>• 핵심 키워드를 포함하세요</li>
                                        <li>• 120-150자가 가장 이상적입니다</li>
                                        <li>• 독자의 관심을 끌 수 있는 문구를 사용하세요</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-gray-200" />

                        {/* Post Settings Section */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                글 설정
                            </h3>
                            <div className="space-y-4">
                                {/* Series */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        시리즈
                                    </label>
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setIsSeriesDropdownOpen(!isSeriesDropdownOpen)}
                                            className="w-full flex items-center justify-between px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-black focus:border-black text-sm hover:bg-gray-50 transition-all">
                                            <span className={selectedSeries.name ? 'text-gray-900' : 'text-gray-400'}>
                                                {selectedSeries.name || '선택 안 함'}
                                            </span>
                                            <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isSeriesDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>

                                        {isSeriesDropdownOpen && (
                                            <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                                <div
                                                    onClick={() => {
                                                        onSeriesChange({
                                                            id: '',
                                                            name: ''
                                                        });
                                                        setIsSeriesDropdownOpen(false);
                                                    }}
                                                    className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 text-sm text-gray-600 transition-colors">
                                                    선택 안 함
                                                </div>
                                                {seriesList.map((series) => (
                                                    <div
                                                        key={series.id}
                                                        onClick={() => {
                                                            onSeriesChange(series);
                                                            setIsSeriesDropdownOpen(false);
                                                        }}
                                                        className={`px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 text-sm transition-colors ${selectedSeries.id === series.id ? 'bg-gray-50 text-gray-900 font-medium' : 'text-gray-700'
                                                            }`}>
                                                        {series.name}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Privacy & Display Options */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3">
                                        고급 옵션
                                    </label>
                                    <div className="space-y-3">
                                        <label className="flex items-start gap-3 p-4 border-2 border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 hover:border-gray-400 transition-all group">
                                            <input
                                                type="checkbox"
                                                checked={formData.hide}
                                                onChange={(e) => onFormDataChange('hide', e.target.checked)}
                                                className="w-5 h-5 text-black border-gray-300 rounded focus:ring-black mt-0.5"
                                            />
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                    </svg>
                                                    <div className="text-sm font-medium text-gray-900">비공개</div>
                                                </div>
                                                <div className="text-xs text-gray-500">본인만 볼 수 있습니다</div>
                                            </div>
                                        </label>

                                        <label className="flex items-start gap-3 p-4 border-2 border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 hover:border-gray-400 transition-all group">
                                            <input
                                                type="checkbox"
                                                checked={formData.notice}
                                                onChange={(e) => onFormDataChange('notice', e.target.checked)}
                                                className="w-5 h-5 text-black border-gray-300 rounded focus:ring-black mt-0.5"
                                            />
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                                    </svg>
                                                    <div className="text-sm font-medium text-gray-900">공지사항</div>
                                                </div>
                                                <div className="text-xs text-gray-500">블로그 상단에 고정됩니다</div>
                                            </div>
                                        </label>

                                        <label className="flex items-start gap-3 p-4 border-2 border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 hover:border-gray-400 transition-all group">
                                            <input
                                                type="checkbox"
                                                checked={formData.advertise}
                                                onChange={(e) => onFormDataChange('advertise', e.target.checked)}
                                                className="w-5 h-5 text-black border-gray-300 rounded focus:ring-black mt-0.5"
                                            />
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <div className="text-sm font-medium text-gray-900">광고 표시</div>
                                                </div>
                                                <div className="text-xs text-gray-500">게시글에 광고가 표시됩니다</div>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-2.5 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors font-medium text-sm">
                        완료
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes slide-in-right {
                    from {
                        transform: translateX(100%);
                    }
                    to {
                        transform: translateX(0);
                    }
                }
                .animate-slide-in-right {
                    animation: slide-in-right 0.3s ease-out;
                }
            `}</style>
        </>
    );
};

export default SettingsDrawer;
