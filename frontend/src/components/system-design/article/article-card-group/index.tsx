import classNames from 'classnames/bind';
import styles from './ArticleCardGroup.module.scss';
const cx = classNames.bind(styles);

import type { Gap } from '~/types/style';

interface ArticleCardGroupProps {
    className?: string;
    children: React.ReactNode;
    gap?: Gap;
}

export function ArticleCardGroup({
    className,
    children,
    gap = 3
}: ArticleCardGroupProps) {
    return (
        <div className={cx('group', `g-${gap}`, className)}>
            {children}
        </div>
    );
}
