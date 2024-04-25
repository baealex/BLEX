import classNames from 'classnames/bind';
import styles from './Flex.module.scss';
const cx = classNames.bind(styles);

type Gap = 0 | 1 | 2 | 3 | 4 | 5;

export interface FlexProps {
    direction?: 'row' | 'column';
    justify?: 'start' | 'end' | 'center' | 'between' | 'around';
    align?: 'start' | 'end' | 'center' | 'stretch' | 'baseline';
    wrap?: 'wrap' | 'nowrap' | 'reverse';
    gap?: Gap;
    rowGap?: Gap;
    columnGap?: Gap;
    className?: string;
    children?: React.ReactNode;
}

export function Flex({
    direction = 'row',
    justify = 'start',
    align = 'start',
    wrap = 'nowrap',
    gap = 0,
    rowGap = 0,
    columnGap = 0,
    children,
    className,
    ...props
}: FlexProps & React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={
                cx([
                    'flex',
                    {
                        [`d-${direction}`]: direction,
                        [`j-${justify}`]: justify,
                        [`a-${align}`]: align,
                        [`w-${wrap}`]: wrap,
                        [`g-${gap}`]: gap,
                        [`rg-${rowGap}`]: rowGap,
                        [`cg-${columnGap}`]: columnGap
                    },
                    className])
            }
            {...props}>
            {children}
        </div>
    );
}