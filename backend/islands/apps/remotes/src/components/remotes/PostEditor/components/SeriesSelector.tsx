import { Dropdown } from '~/components/shared';
import { baseInputStyles } from '~/components/shared';

interface Series {
    id: string;
    name: string;
}

interface SeriesSelectorProps {
    seriesList: Series[];
    selectedSeries: { id: string; name: string };
    onSeriesChange: (series: { id: string; name: string }) => void;
}

const SeriesSelector = ({
    seriesList,
    selectedSeries,
    onSeriesChange
}: SeriesSelectorProps) => {
    const handleSeriesSelect = (series: Series | null) => {
        onSeriesChange({
            id: series?.id || '',
            name: series?.name || ''
        });
    };

    const dropdownItems = [
        {
            label: '선택 안 함',
            onClick: () => handleSeriesSelect(null),
            checked: !selectedSeries.id
        },
        ...seriesList.map(series => ({
            label: series.name,
            onClick: () => handleSeriesSelect(series),
            checked: selectedSeries.id === series.id
        }))
    ];

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">시리즈</label>

            <Dropdown
                align="start"
                items={dropdownItems}
                trigger={
                    <button
                        type="button"
                        className={`${baseInputStyles} flex items-center justify-between text-left`}>
                        <span className={selectedSeries.name ? 'text-gray-900 font-medium' : 'text-gray-400'}>
                            {selectedSeries.name || '선택 안 함'}
                        </span>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                }
            />
        </div>
    );
};

export default SeriesSelector;
