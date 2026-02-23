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

        const rootStyle = window.getComputedStyle(document.documentElement);
        const lineColor = rootStyle.getPropertyValue('--color-line').trim() || '#d1d5db';
        const strongLineColor = rootStyle.getPropertyValue('--color-line-strong').trim() || '#6b7280';
        const hintColor = rootStyle.getPropertyValue('--color-content-hint').trim() || '#9ca3af';
        const isDarkTheme = document.documentElement.dataset.theme === 'dark';

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
        const cleanupHandlers: Array<() => void> = [];

        dayCells.forEach((cell) => {
            cell.style.stroke = lineColor;
            cell.style.strokeWidth = '0.7';
            cell.style.transition = 'filter 120ms ease, stroke 120ms ease, stroke-width 120ms ease';
            cell.style.filter = 'saturate(0.9)';

            const onMouseEnter = () => {
                cell.style.filter = isDarkTheme ? 'brightness(1.12) saturate(1.06)' : 'brightness(0.93)';
                cell.style.stroke = strongLineColor;
                cell.style.strokeWidth = '1';
            };

            const onMouseLeave = () => {
                cell.style.filter = 'saturate(0.9)';
                cell.style.stroke = lineColor;
                cell.style.strokeWidth = '0.7';
            };

            cell.addEventListener('mouseenter', onMouseEnter);
            cell.addEventListener('mouseleave', onMouseLeave);

            cleanupHandlers.push(() => {
                cell.removeEventListener('mouseenter', onMouseEnter);
                cell.removeEventListener('mouseleave', onMouseLeave);
            });
        });

        legendCells.forEach((cell) => {
            cell.style.stroke = lineColor;
            cell.style.strokeWidth = '0.7';
        });

        labels.forEach((label) => {
            label.style.fill = hintColor;
            label.style.fontSize = '10px';
            label.style.fontWeight = '500';
        });

        return () => {
            cleanupHandlers.forEach((cleanup) => cleanup());
        };
    }, [data, countLabel, colors]);

    return <div ref={chartRef} className={className} />;
};
