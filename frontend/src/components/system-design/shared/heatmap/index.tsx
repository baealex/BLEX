import classNames from 'classnames/bind';
import styles from './Heatmap.module.scss';
const cx = classNames.bind(styles);

import { useMemo } from 'react';

import Chart from '~/components/system-design/chart';
import { Card } from '~/components/design-system';

export interface HeatmapProps {
    isNightMode: boolean;
    data?: {
        [key: string]: number;
    };
}

export function Heatmap(props: HeatmapProps) {
    const { data = {} } = props;

    const totalActivity = useMemo(() => {
        return Object.values(data).reduce((acc, cur) => acc + cur, 0);
    }, [data]);

    return (
        <Card isRounded hasShadow className={`${cx('heatmap')} py-3`}>
            <Chart
                type="heatmap"
                title={`지난 1년 동안 ${totalActivity}건의 활동을 기록했습니다.`}
                data={{
                    end: new Date(),
                    dataPoints: data
                }}
                width={800}
                countLabel="Activity"
                discreteDomains={0}
                colors={props.isNightMode ? ['#14120f', '#391b74', '#843690', '#dc65c4', '#e69ed8'] : undefined}
                deps={[props.isNightMode]}
            />
        </Card>
    );
}
