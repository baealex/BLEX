import classNames from 'classnames/bind';
import styles from './RecentActivity.module.scss';
const cn = classNames.bind(styles);

import {
    ActivityItem,
    ActivityItemProps
} from './activity-item';

export interface RecentActivityProps {
    data: ActivityItemProps[];
}

export function RecentActivity(props: RecentActivityProps) {
    return (
        <>
            {props.data.length > 0 && (
                <ul className={`${cn('activity')} p-0 mt-3`}>
                    {props.data.map((item: ActivityItemProps, idx: number) => (
                        <ActivityItem key={idx} {...item}/>
                    ))}
                </ul>
            )}
        </>
    );
}