import classNames from 'classnames/bind';
import styles from './Loading.module.scss';
const cn = classNames.bind(styles);

export interface LoadingProps {
    isFullPage?: boolean;
}

export function Loading({ isFullPage = false }: LoadingProps) {
    return (
        <div className={cn(isFullPage ? 'block' : 'box')}>
            <div className="dot-bricks"/>
        </div>
    );
}