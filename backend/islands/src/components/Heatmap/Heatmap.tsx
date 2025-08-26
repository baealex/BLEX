import { useMemo, useEffect, useRef } from 'react';
import { http } from '~/modules/http.module';
import { useFetch } from '~/hooks/use-fetch';
import { Chart as FrappeCharts } from 'frappe-charts';

interface HeatmapProps {
    data?: {
        [key: string]: number;
    };
}

const Heatmap = ({ data }: HeatmapProps) => {
    const chartRef = useRef<HTMLDivElement>(null);

    const { data: heatmapData, isLoading } = useFetch<{ [key: string]: number }>({
        queryKey: ['dashboard-heatmap'],
        queryFn: async () => {
            if (data) {
                return data;
            }
            // 현재 사용자의 히트맵 데이터 가져오기
            const { data: response } = await http('/v1/setting/profile', { method: 'GET' });
            if (response.status === 'DONE') {
                return response.body.heatmap || {};
            }
            return {};
        }
    });

    const totalActivity = useMemo(() => {
        if (!heatmapData) return 0;
        return Object.values(heatmapData).reduce((acc, cur) => acc + cur, 0);
    }, [heatmapData]);

    useEffect(() => {
        if (chartRef.current && heatmapData) {
            // 컨테이너 너비 가져오기
            const containerWidth = chartRef.current.parentElement?.clientWidth || 800;

            // Frappe Charts 히트맵 생성
            const chart = new FrappeCharts(chartRef.current, {
                type: 'heatmap',
                title: `지난 1년 동안 ${totalActivity.toLocaleString()}건의 활동을 기록했습니다.`,
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
        }
    }, [heatmapData, totalActivity]);

    if (isLoading) {
        return (
            <div className="animate-pulse">
                <div className="h-6 bg-slate-200 rounded w-48 mb-4" />
                <div className="h-48 bg-slate-200 rounded" />
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="overflow-x-auto">
                <div ref={chartRef} />
            </div>
        </div>
    );
};

export default Heatmap;
