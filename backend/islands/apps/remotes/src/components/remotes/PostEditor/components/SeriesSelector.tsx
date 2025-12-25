import { Select } from '@blex/ui';

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
    const handleValueChange = (value: string) => {
        if (value === '') {
            onSeriesChange({
 id: '',
name: ''
});
        } else {
            const series = seriesList.find(s => s.id === value);
            onSeriesChange({
                id: series?.id || '',
                name: series?.name || ''
            });
        }
    };

    const selectItems = [
        {
 value: '',
label: '선택 안 함'
},
        ...seriesList.map(series => ({
            value: series.id,
            label: series.name
        }))
    ];

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">시리즈</label>
            <Select
                value={selectedSeries.id}
                onValueChange={handleValueChange}
                items={selectItems}
                placeholder="선택 안 함"
            />
        </div>
    );
};

export default SeriesSelector;
