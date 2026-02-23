import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Heatmap as UIHeatmap } from '@blex/ui/heatmap';
import { getAuthorHeatmap } from '~/lib/api/author';
import { useResolvedTheme } from '~/hooks/useResolvedTheme';

interface HeatmapProps {
    username: string;
}

const LIGHT_HEATMAP_SCALE = ['#f9fafb', '#d1d5db', '#9ca3af', '#6b7280', '#1f2937'];
const DARK_HEATMAP_SCALE = ['#222222', '#393939', '#555555', '#737373', '#969696'];

const styleHeatmapCells = (root: HTMLElement, colorScale: string[]) => {
    const dayCells = Array.from(root.querySelectorAll<SVGRectElement>('.author-heatmap-chart rect.day'));
    const legendCells = Array.from(root.querySelectorAll<SVGRectElement>('.author-heatmap-chart rect.heatmap-legend-unit'));
    const legendGroup = root.querySelector<SVGGElement>('.author-heatmap-chart g.chart-legend');

    if (dayCells.length === 0) {
        return;
    }

    if (legendGroup) {
        const originalTransform =
            legendGroup.getAttribute('data-original-transform')
            || legendGroup.getAttribute('transform')
            || '';

        if (!legendGroup.getAttribute('data-original-transform')) {
            legendGroup.setAttribute('data-original-transform', originalTransform);
        }

        const match = originalTransform.match(/translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);
        if (match) {
            const x = Number(match[1]);
            const y = Number(match[2]);
            if (Number.isFinite(x) && Number.isFinite(y)) {
                legendGroup.setAttribute('transform', `translate(${x}, ${y + 8})`);
            }
        }
    }

    let maxValue = 0;
    dayCells.forEach((cell) => {
        const rawValue = Number(cell.getAttribute('data-value') || '0');
        if (Number.isFinite(rawValue) && rawValue > maxValue) {
            maxValue = rawValue;
        }
    });

    dayCells.forEach((cell) => {
        const rawValue = Number(cell.getAttribute('data-value') || '0');
        const value = Number.isFinite(rawValue) ? rawValue : 0;
        const scaleMaxIndex = colorScale.length - 1;
        const colorIndex = value <= 0 || maxValue <= 0
            ? 0
            : Math.max(1, Math.min(scaleMaxIndex, Math.round(Math.sqrt(value / maxValue) * scaleMaxIndex)));

        cell.setAttribute('fill', colorScale[colorIndex]);
        cell.setAttribute('rx', '3');
    });

    legendCells.forEach((cell, index) => {
        const scaleMaxIndex = colorScale.length - 1;
        const colorIndex = Math.min(scaleMaxIndex, index + 1);
        cell.setAttribute('fill', colorScale[colorIndex]);
        cell.setAttribute('rx', '3');
    });
};

const Heatmap = ({ username }: HeatmapProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const resolvedTheme = useResolvedTheme();
    const colorScale = resolvedTheme === 'dark' ? DARK_HEATMAP_SCALE : LIGHT_HEATMAP_SCALE;

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

    useEffect(() => {
        if (!containerRef.current || !heatmapData) return;
        const root = containerRef.current;

        let rafId = 0;
        const applyStyles = () => {
            if (rafId) {
                window.cancelAnimationFrame(rafId);
            }
            rafId = window.requestAnimationFrame(() => {
                styleHeatmapCells(root, colorScale);
            });
        };

        applyStyles();

        const timeoutId = window.setTimeout(applyStyles, 220);
        const delayedTimeoutId = window.setTimeout(applyStyles, 520);

        const observer = new MutationObserver(() => {
            applyStyles();
        });

        observer.observe(root, {
            childList: true,
            subtree: true
        });

        return () => {
            window.cancelAnimationFrame(rafId);
            window.clearTimeout(timeoutId);
            window.clearTimeout(delayedTimeoutId);
            observer.disconnect();
        };
    }, [colorScale, heatmapData]);

    if (!heatmapData || isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-line-strong" />
            </div>
        );
    }

    const activityCount = Object.values(heatmapData).reduce((acc, cur) => acc + cur, 0);

    return (
        <div ref={containerRef} className="overflow-x-auto">
            <style>
                {`
                    .author-heatmap-chart .chart-container {
                        border-radius: 14px;
                        padding: 6px 10px 2px;
                        background: var(--color-surface);
                    }

                    .author-heatmap-chart rect.day {
                        stroke: var(--color-surface);
                        stroke-width: 1;
                        transition: transform 120ms ease, filter 120ms ease, stroke 120ms ease;
                        transform-box: fill-box;
                        transform-origin: center;
                    }

                    .author-heatmap-chart rect.day:hover {
                        transform: scale(1.08);
                        filter: brightness(0.94) saturate(1.08);
                        stroke: var(--color-line-strong);
                    }

                    [data-theme="dark"] .author-heatmap-chart rect.day:hover {
                        filter: brightness(1.12) saturate(1.08);
                    }

                    .author-heatmap-chart text.domain-name,
                    .author-heatmap-chart text.subdomain-name {
                        fill: var(--color-content-hint);
                        font-size: 10px;
                        font-weight: 600;
                        letter-spacing: 0.015em;
                    }

                    .author-heatmap-chart .graph-svg-tip {
                        background: var(--color-surface);
                        color: var(--color-content);
                        border: 1px solid var(--color-line);
                        border-radius: 10px;
                        backdrop-filter: blur(6px);
                    }

                    .author-heatmap-chart .chart-legend text.subdomain-name {
                        fill: var(--color-content-secondary);
                    }
                `}
            </style>
            <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                    <p className="text-xs font-medium text-content-secondary">지난 1년 활동</p>
                    <p className="text-lg font-semibold text-content tabular-nums">
                        {activityCount.toLocaleString()}
                        <span className="ml-1 text-sm font-medium text-content-secondary">회</span>
                    </p>
                </div>
                <p className="text-xs text-content-hint">단위: 활동</p>
            </div>
            <UIHeatmap
                key={resolvedTheme}
                data={{
                    dataPoints: heatmapData,
                    end: new Date()
                }}
                countLabel="활동"
                colors={colorScale}
                className="author-heatmap-chart mx-auto w-fit"
            />
        </div>
    );
};

export default Heatmap;
