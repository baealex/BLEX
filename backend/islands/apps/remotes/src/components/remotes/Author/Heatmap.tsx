import { useQuery } from '@tanstack/react-query';
import { Heatmap as UIHeatmap } from '@blex/ui';
import { getAuthorHeatmap } from '~/lib/api/author';

interface HeatmapProps {
    username: string;
}

const Heatmap = ({ username }: HeatmapProps) => {
    // Fetch heatmap data
    const { data: heatmapData, isLoading } = useQuery<{ [key: string]: number }>({
        queryKey: ['author-heatmap', username],
        queryFn: async () => {
            const { data: response } = await getAuthorHeatmap(username);
            if (response.status === 'DONE') {
                // Fix date format: humps.camelize converts '2024-11-21' to '20241121'
                const rawHeatmap = response.body || {};
                const fixedHeatmap: { [key: string]: number } = {};

                Object.entries(rawHeatmap).forEach(([date, count]) => {
                    const numCount = Number(count);
                    if (/^\d{8}$/.test(date)) {
                        const fixedDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
                        fixedHeatmap[fixedDate] = numCount;
                    } else {
                        fixedHeatmap[date] = numCount;
                    }
                });

                return fixedHeatmap;
            }
            return {};
        }
    });

    if (!heatmapData || isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
            </div>
        );
    }

    const activityCount = Object.values(heatmapData).reduce((acc, cur) => acc + cur, 0);

    return (
        <div className="overflow-x-auto">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
                지난 1년: {activityCount.toLocaleString()}개의 활동
            </h3>
            <UIHeatmap
                data={{
                    dataPoints: heatmapData,
                    end: new Date()
                }}
                countLabel="활동"
                className="mx-auto w-fit"
            />
        </div>
    );
};

export default Heatmap;
