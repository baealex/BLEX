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
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">시리즈</label>

            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="w-full flex items-center justify-between px-3 py-2 border border-solid border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent text-sm hover:bg-gray-50 transition-colors">
                    <span className={selectedSeries.name ? 'text-gray-900' : 'text-gray-400'}>
                        {selectedSeries.name || '선택 안 함'}
                    </span>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {isDropdownOpen && (
                    <div className="absolute z-10 w-full mt-2 bg-white border border-solid border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        <div
                            onClick={() => handleSeriesSelect(null)}
                            className="px-3 py-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-100 text-sm text-gray-600">
                            선택 안 함
                        </div>
                        {seriesList.map((series) => (
                            <div
                                key={series.id}
                                onClick={() => handleSeriesSelect(series)}
                                className={`px-3 py-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 text-sm ${
                                    selectedSeries.id === series.id ? 'bg-gray-50 text-gray-900 font-medium' : 'text-gray-700'
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
