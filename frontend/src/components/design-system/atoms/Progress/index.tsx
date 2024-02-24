import classNames from 'classnames/bind';
import styles from './Progress.module.scss';
const cx = classNames.bind(styles);

import type { ProgressProps } from './types';

import { ProgressBar } from './ProgressBar';
import { ProgressTimer } from './ProgressTimer';

export function Progress(props: ProgressProps) {
    return (
        <div className={cx('progress', props.className)}>
            {props.type === 'timer' && (
                <ProgressTimer {...props} />
            )}
            {props.type === 'bar' && (
                <ProgressBar {...props} />
            )}
        </div>
    );
}