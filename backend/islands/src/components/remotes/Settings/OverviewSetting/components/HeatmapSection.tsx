import { useEffect, useRef, useMemo } from 'react';
import { Chart as FrappeCharts } from 'frappe-charts';

interface HeatmapSectionProps {
    heatmapData?: { [key: string]: number };
    isLoading: boolean;
}

const HeatmapSection = ({ heatmapData, isLoading }: HeatmapSectionProps) => {
    const chartRef = useRef<HTMLDivElement>(null);

    const totalActivity = useMemo(() => {
        if (!heatmapData) return 0;
        return Object.values(heatmapData).reduce((acc, cur) => acc + cur, 0);
    }, [heatmapData]);

    // Initialize heatmap chart
    useEffect(() => {
        if (!chartRef.current || !heatmapData) return;

        const containerWidth = chartRef.current.parentElement?.clientWidth || 800;
        const activityCount = Object.values(heatmapData).reduce((acc, cur) => acc + cur, 0);

        const chart = new FrappeCharts(chartRef.current, {
            type: 'heatmap',
            title: `지난 1년 동안 ${activityCount.toLocaleString()}건의 활동을 기록했습니다.`,
            data: {
                end: new Date(),
                dataPoints: heatmapData
            },
            width: Math.max(containerWidth, 800),
            height: 200,
            countLabel: 'Activity',
            discreteDomains: 0,
            colors: ['#ebedf0', '#c6e48b', '#7bc96f', '#239a3b', '#196127']
        });

        return () => {
            chart.destroy();
        };
    }, [heatmapData]);

    if (isLoading) {
        return (
            <div className="p-6 bg-white shadow-sm rounded-2xl border border-gray-200">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
                        <i className="fas fa-fire mr-3" />
                        활동 히트맵
                    </h2>
                </div>
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-gray-200 rounded w-3/4" />
                    <div className="h-48 bg-gray-200 rounded" />
                </div>
            </div>
        );
    }

    if (!heatmapData || Object.keys(heatmapData).length === 0) {
        return (
            <div className="p-6 bg-white shadow-sm rounded-2xl border border-gray-200">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
                        <i className="fas fa-fire mr-3" />
                        활동 히트맵
                    </h2>
                </div>
                <div className="flex flex-col items-center justify-center py-16 px-4">
                    <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mb-4">
                        <i className="fas fa-chart-bar text-gray-400 text-3xl" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">아직 활동 기록이 없습니다</h3>
                    <p className="text-gray-500 text-sm text-center max-w-md">
                        포스트를 작성하거나 댓글을 남기면 여기에 활동 히트맵이 표시됩니다.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 bg-white shadow-sm rounded-2xl border border-gray-200">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
                    <i className="fas fa-fire mr-3" />
                    활동 히트맵
                </h2>
            </div>
            <div className="w-full overflow-x-auto">
                <div ref={chartRef} />
            </div>
        </div>
    );
};

export default HeatmapSection;
