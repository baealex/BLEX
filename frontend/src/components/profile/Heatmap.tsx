import { useEffect } from 'react';
import { Chart } from 'frappe-charts';

interface HeatmapProps {
    isNightMode: boolean;
    data: {
        [key: string]: number;
    };
}

export default function Heatmap(props: HeatmapProps) {
    useEffect(() => {
        new Chart('#heatmap', {
            type: 'heatmap',
            title: `${Object.keys(props.data).length} activity in the last year`,
            data: {
                end: new Date(),
                dataPoints: props.data
            },
            width: 800,
            countLabel: 'Activity',
            discreteDomains: 0,
            colors: props.isNightMode ? ['#14120f', '#391b74', '#843690', '#dc65c4', '#e69ed8'] : undefined
        })
    }, [props.isNightMode]);

    return (
        <div className="heatmap mt-5">
            <div id="heatmap"/>
        </div>
    )
}