import classNames from 'classnames/bind';
import styles from './Grid.module.scss';
const cx = classNames.bind(styles);

type Gap = 0 | 1 | 2 | 3 | 4 | 5;

type GridCell = 1 | 2 | 3 | 4 | 5;

interface Responsive {
    desktop?: GridCell;
    tablet?: GridCell;
    mobile?: GridCell;
}

export interface GridProps {
    gap?: Gap;
    rowGap?: Gap;
    columnGap?: Gap;
    column?: Responsive;
    row?: Responsive;
    children: React.ReactNode;
}

export function Grid({
    gap = 0,
    rowGap = 0,
    columnGap = 0,
    column,
    row,
    children
}: GridProps) {
    return (
        <div
            className={cx(
                'grid',
                gap && `g-${gap}`,
                rowGap && `rg-${rowGap}`,
                columnGap && `cg-${columnGap}`,
                column?.mobile && `gtc-m-${column.mobile}`,
                column?.tablet && `gtc-t-${column.tablet}`,
                column?.desktop && `gtc-p-${column.desktop}`,
                row?.mobile && `gtr-m-${row.mobile}`,
                row?.tablet && `gtr-t-${row.tablet}`,
                row?.desktop && `gtr-p-${row.desktop}`
            )}>
            {children}
        </div>
    );
}
