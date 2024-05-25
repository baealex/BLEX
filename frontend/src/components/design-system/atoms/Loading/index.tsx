import classNames from 'classnames/bind';
import styles from './Loading.module.scss';
const cx = classNames.bind(styles);

export interface LoadingProps {
    position?: 'center' | 'full' | 'inline';
}

export function Loading({ position = 'center' }: LoadingProps) {
    return (
        <div className={cx(position)}>
            <div className={cx('spinner')}/>
        </div>
    );
}
