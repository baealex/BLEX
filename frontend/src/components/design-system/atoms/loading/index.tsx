import classNames from 'classnames/bind';
import styles from './Loading.module.scss';
const cn = classNames.bind(styles);

export interface LoadingProps {
    block?: boolean;
}

export function Loading({ block = false }: LoadingProps) {
    return (
        <div className={cn(block ? 'block' : 'box')}>
            <div className="dot-bricks"/>
        </div>
    );
}