import { useRef, useEffect } from 'react';
import { Chart as FrappeCharts } from 'frappe-charts';

interface InteractiveHeatmapProps {
    heatmapData: { [key: string]: number };
    isLoading: boolean;
    onDateClick: (date: string) => void;
}

const InteractiveHeatmap = ({ heatmapData, isLoading, onDateClick }: InteractiveHeatmapProps) => {
    const chartRef = useRef<HTMLDivElement>(null);

    // Initialize heatmap chart
    useEffect(() => {
        if (!chartRef.current || !heatmapData || Object.keys(heatmapData).length === 0) return;

        const containerWidth = chartRef.current.parentElement?.clientWidth || 800;
        const activityCount = Object.values(heatmapData).reduce((acc, cur) => acc + cur, 0);

        new FrappeCharts(chartRef.current, {
            type: 'heatmap',
            title: `Last year: ${activityCount.toLocaleString()} contributions`,
            data: {
                end: new Date(),
                dataPoints: heatmapData
            },
            width: Math.max(containerWidth, 800),
            height: 200,
            countLabel: 'Activity',
            discreteDomains: 0,
            colors: ['#ebedf0', '#c6e48b', '#7bc96f', '#239a3b', '#196127'],
            isNavigable: true // Make it interactive
        });

        // Add click event listener to the chart
        // Frappe Charts API for click events is a bit limited, often requires binding to SVG elements
        // But let's check if 'isNavigable' allows selection.
        // Actually, 'isNavigable' allows navigating with arrow keys and selecting.
        // There is 'onclick' event in config?
        // Documentation says:
        // onclick: (datapoint) => { ... }

        // Let's try to add onclick.
        // However, standard Frappe Charts type might not expose it in TS or it's different.
        // We will try to pass it in options.

        // Re-creating chart to include onclick
        chartRef.current.innerHTML = ''; // Clear previous chart
        new FrappeCharts(chartRef.current, {
            type: 'heatmap',
            title: `Last year: ${activityCount.toLocaleString()} contributions`,
            data: {
                end: new Date(),
                dataPoints: heatmapData
            },
            width: Math.max(containerWidth, 800),
            height: 200,
            countLabel: 'Activity',
            discreteDomains: 0,
            colors: ['#ebedf0', '#c6e48b', '#7bc96f', '#239a3b', '#196127'],
            isNavigable: 1,
            onclick: (data: { date: string }) => {
                if (data && data.date) {
                    onDateClick(data.date);
                }
            }
        });

        const chartElement = chartRef.current;
        return () => {
             // clearing innerHTML is safer usually
             if (chartElement) chartElement.innerHTML = '';
        };
    }, [heatmapData, onDateClick]);

    if (isLoading) {
        return <div className="animate-pulse h-[200px] bg-gray-100 rounded-xl w-full" />;
    }

    if (!heatmapData || Object.keys(heatmapData).length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-10 bg-gray-50 rounded-xl border border-gray-100">
                <i className="fas fa-seedling text-gray-300 text-3xl mb-3" />
                <p className="text-gray-500 text-sm">No activity recorded yet.</p>
            </div>
        );
    }

    return (
        <div className="w-full overflow-x-auto">
            <div ref={chartRef} />
        </div>
    );
};

export default InteractiveHeatmap;
