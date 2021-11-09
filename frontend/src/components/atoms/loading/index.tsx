import styles from './Loading.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

export interface LoadingProps {
    block?: boolean;
}

export function Loading({
    block=false
}: LoadingProps) {
    return (
        <div className={cn(block ? 'block' : 'box')}>
            <div className="dot-bricks"/>
        </div>
    )
}