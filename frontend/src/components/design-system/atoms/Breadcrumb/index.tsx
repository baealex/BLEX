
import classNames from 'classnames/bind';
import styles from './Breadcrumb.module.scss';
const cx = classNames.bind(styles);

import Link from 'next/link';

export interface BreadcrumbProps {
    className?: string;
    depths: {
        label: string;
        url: string;
    }[];
    current: string;
}

export function Breadcrumb({
    className,
    depths,
    current
}: BreadcrumbProps) {
    return (
        <div className={cx('breadcrumb', className)}>
            {depths.filter(depth => depth.label !== current).map(({ label, url }, index) => (
                <Link
                    key={index}
                    href={url}
                    className={cx('depth')}>
                    {label}
                </Link>
            ))}
            <span className={cx('current')}>
                {current}
            </span>
        </div>
    );
}