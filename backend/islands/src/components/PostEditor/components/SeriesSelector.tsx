import React, { useState } from 'react';

interface Series {
    id: string;
    name: string;
}

interface SeriesSelectorProps {
    seriesList: Series[];
    selectedSeries: { id: string; name: string };
    onSeriesChange: (series: { id: string; name: string }) => void;
}

const SeriesSelector: React.FC<SeriesSelectorProps> = ({
    seriesList,
    selectedSeries,
    onSeriesChange
}) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const handleSeriesSelect = (series: Series | null) => {
        onSeriesChange({
            id: series?.id || '',
            name: series?.name || ''
        });
        setIsDropdownOpen(false);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
            <label className="block text-sm font-semibold text-slate-700 mb-4">시리즈</label>

            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="w-full flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border border-solid border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base">
                    <span className="text-slate-700">
                        {selectedSeries.name || '시리즈 선택'}
                    </span>
                    <svg className={`w-5 h-5 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {isDropdownOpen && (
                    <div className="absolute z-10 w-full mt-2 bg-white border border-slate-300 rounded-lg shadow-lg max-h-48 sm:max-h-64 overflow-y-auto">
                        <div
                            onClick={() => handleSeriesSelect(null)}
                            className="px-3 sm:px-4 py-2 sm:py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 text-sm sm:text-base">
                            없음
                        </div>
                        {seriesList.map((series) => (
                            <div
                                key={series.id}
                                onClick={() => handleSeriesSelect(series)}
                                className={`px-3 sm:px-4 py-2 sm:py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0 text-sm sm:text-base ${
                                    selectedSeries.id === series.id ? 'bg-blue-50 text-blue-700' : ''
                                }`}>
                                {series.name}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SeriesSelector;