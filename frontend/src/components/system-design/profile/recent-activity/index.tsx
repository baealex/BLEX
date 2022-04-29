import classNames from 'classnames/bind';
import styles from './RecentActivity.module.scss';
const cn = classNames.bind(styles);

import {
    ActivityItem,
    ActivityItemProps,
} from './activity-item';

import { Alert } from '@design-system';

export interface RecentActivityProps {
    data: ActivityItemProps[];
}

export function RecentActivity(props: RecentActivityProps) {
    return (
        <>
            <div className="h5 font-weight-bold mt-5">
                최근 활동
            </div>
            {props.data.length > 0 ? (
                <ul className={`${cn('activity')} gothic p-0 mt-4`}>
                    {props.data.map((item: ActivityItemProps, idx: number) => (
                        <ActivityItem key={idx} {...item}/>
                    ))}
                </ul>
            ) : (
                <Alert className="mt-3">
                    최근 활동이 없습니다.
                </Alert>
            )}
        </>
    );
}