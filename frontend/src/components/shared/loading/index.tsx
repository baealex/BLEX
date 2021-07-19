import styles from './Loading.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

export function Loading() {
    return (
        <div className={cn('loading')}>
            <div className={cn('mask')}>
                <div className="m-center dot-bricks"></div>
            </div>
        </div>
    )
}