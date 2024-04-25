import classNames from 'classnames/bind';
import styles from './ArticleCardGroup.module.scss';
const cx = classNames.bind(styles);

import { FlexProps } from '~/components/design-system';

interface ArticleCardGroupProps {
    className?: string;
    children: React.ReactNode;
    gap?: FlexProps['gap'];
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