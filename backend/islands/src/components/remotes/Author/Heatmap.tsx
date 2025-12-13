import { useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Chart as FrappeCharts } from 'frappe-charts';
import { getAuthorHeatmap } from '~/lib/api/author';

interface HeatmapProps {
    username: string;
}

const Heatmap = ({ username }: HeatmapProps) => {
    const chartRef = useRef<HTMLDivElement>(null);

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

    // Initialize heatmap chart
    useEffect(() => {
        if (!chartRef.current || !heatmapData || Object.keys(heatmapData).length === 0) return;

        const containerWidth = chartRef.current.parentElement?.clientWidth || 800;
        const activityCount = Object.values(heatmapData).reduce((acc, cur) => acc + cur, 0);

        chartRef.current.innerHTML = '';
        new FrappeCharts(chartRef.current, {
            type: 'heatmap',
            title: `지난 1년: ${activityCount.toLocaleString()}개의 활동`,
            data: {
                end: new Date(),
                dataPoints: heatmapData
            },
            width: Math.max(containerWidth, 800),
            height: 200,
            countLabel: '활동',
            discreteDomains: 0,
            colors: ['#ebedf0', '#c6e48b', '#7bc96f', '#239a3b', '#196127']
        });
    }, [heatmapData]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
            </div>
        );
    }

    if (!heatmapData || Object.keys(heatmapData).length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-400">활동 데이터가 없습니다</p>
            </div>
        );
    }

    return <div ref={chartRef} className="overflow-x-auto" />;
};

export default Heatmap;
