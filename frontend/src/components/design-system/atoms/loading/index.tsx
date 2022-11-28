import classNames from 'classnames/bind';
import styles from './Loading.module.scss';
const cn = classNames.bind(styles);

export interface LoadingProps {
    position?: 'center' | 'full' | 'inline';
}

export function Loading({ position = 'center' }: LoadingProps) {
    return (
        <div className={cn(position)}>
            <div className={cn('spinner')}/>
        </div>
    );
}
