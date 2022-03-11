import styles from './Heatmap.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import { useEffect } from 'react';
import { Chart } from 'frappe-charts';

export interface HeatmapProps {
    isNightMode: boolean;
    data?: {
        [key: string]: number;
    };
}

export function Heatmap(props: HeatmapProps) {
    const {
        data = {},
    } = props;

    useEffect(() => {
        new Chart('#heatmap', {
            type: 'heatmap',
            title: `${Object.keys(data).length} activity in the last year`,
            data: {
                end: new Date(),
                dataPoints: data
            },
            width: 800,
            countLabel: 'Activity',
            discreteDomains: 0,
            colors: props.isNightMode ? ['#14120f', '#391b74', '#843690', '#dc65c4', '#e69ed8'] : undefined
        })
    }, [props.isNightMode]);

    return (
        <div className={`${cn('heatmap')} mt-5`}>
            <div id="heatmap"/>
        </div>
    )
}