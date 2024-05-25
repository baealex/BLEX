import classNames from 'classnames/bind';
import styles from './Progress.module.scss';
const cx = classNames.bind(styles);

import type { ProgressBarProps } from './types';

export function ProgressBar({
    value,
    max = 100,
    ...props
}: ProgressBarProps) {

    return (
        <div className={cx('progress', props.className)}>
            <div
                className={cx('progress-bar')}
                role="progressbar"
                style={{ transform: `translateX(-${value / max * 100}%)` }}
                aria-valuenow={value}
                aria-valuemin={0}
                aria-valuemax={max}></div>
        </div>
    );
}