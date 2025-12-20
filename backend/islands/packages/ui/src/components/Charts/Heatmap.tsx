import { useRef, useEffect } from 'react';
import { Chart } from 'frappe-charts';

export interface HeatmapProps {
    data: {
        dataPoints: Record<string, number>;
        start?: Date;
        end?: Date;
    };
    countLabel?: string;
    colors?: string[];
}

export const Heatmap = ({
    data,
    countLabel = 'Contribution',
    colors = ['#ebedf0', '#c6e48b', '#7bc96f', '#239a3b', '#196127']
}: HeatmapProps) => {
    const chartRef = useRef<HTMLDivElement>(null);
    const chartInstance = useRef<Chart>(null);

    useEffect(() => {
        if (!chartRef.current) return;

        // Clean up previous chart
        if (chartInstance.current) {
            chartInstance.current = null;
            chartRef.current.innerHTML = '';
        }

        chartInstance.current = new Chart(chartRef.current, {
            type: 'heatmap',
            data: data,
            countLabel: countLabel,
            colors: colors,
            height: 150,
            discreteDomains: 0  // If you want discrete domains
        });

    }, [data, countLabel, colors]);

    return <div ref={chartRef} className="w-full" />;
};
