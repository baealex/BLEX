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
    className?: string;
}

export const Heatmap = ({
    data,
    countLabel = 'Contribution',
    colors = ['#ebedf0', '#c6e48b', '#7bc96f', '#239a3b', '#196127'],
    className = 'w-full'
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
            radius: 2,
            discreteDomains: 0  // If you want discrete domains
        });

        const container = chartRef.current;
        const dayCells = container.querySelectorAll<SVGRectElement>('rect.day');
        const legendCells = container.querySelectorAll<SVGRectElement>('rect.heatmap-legend-unit');
        const labels = container.querySelectorAll<SVGTextElement>('text.domain-name, text.subdomain-name');

        dayCells.forEach((cell) => {
            cell.style.stroke = 'rgba(255, 255, 255, 0.72)';
            cell.style.strokeWidth = '0.7';
            cell.style.transition = 'filter 120ms ease, stroke 120ms ease, stroke-width 120ms ease';
            cell.style.filter = 'saturate(0.9)';

            cell.addEventListener('mouseenter', () => {
                cell.style.filter = 'brightness(0.93)';
                cell.style.stroke = 'rgba(31, 41, 55, 0.4)';
                cell.style.strokeWidth = '1';
            });

            cell.addEventListener('mouseleave', () => {
                cell.style.filter = 'saturate(0.9)';
                cell.style.stroke = 'rgba(255, 255, 255, 0.72)';
                cell.style.strokeWidth = '0.7';
            });
        });

        legendCells.forEach((cell) => {
            cell.style.stroke = 'rgba(255, 255, 255, 0.72)';
            cell.style.strokeWidth = '0.7';
        });

        labels.forEach((label) => {
            label.style.fill = '#9ca3af';
            label.style.fontSize = '10px';
            label.style.fontWeight = '500';
        });

    }, [data, countLabel, colors]);

    return <div ref={chartRef} className={className} />;
};
