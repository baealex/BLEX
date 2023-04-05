import classNames from 'classnames/bind';
import styles from './Masonry.module.scss';
const cn = classNames.bind(styles);

import { useEffect, useRef } from 'react';
import { optimizeEvent } from '~/modules/optimize/event';

interface MasonryProps {
    items: React.ReactNode[];
}

export function Masonry({ items }: MasonryProps) {
    const ref = useRef<HTMLDivElement>(null);

    const buildMasonryLayout = () => {
        if (!ref.current) return;

        const marginWidth = 16;
        const marginHeight = 24;
        const gridSize = window.innerWidth > 1200
            ? 3
            : window.innerWidth > 768
                ? 2
                : 1;

        const items = Array.from<HTMLElement>(ref.current.querySelectorAll(`.${cn('item')}`));

        if (gridSize === 1) {
            ref.current.style.height = 'auto';
            for (let i=0; i<items.length; i++) {
                Object.assign(items[i].style, {
                    width: '100%',
                    opacity: '1',
                    display: 'block',
                    position: 'static',
                    transform: 'none',
                    visibility: 'visible'
                });
            }
        } else {
            const grid = new Array(gridSize).fill(0);
            const leftWidth = (ref.current.offsetWidth) / grid.length + marginWidth / 2;
            for (let i=0; i<items.length; i++) {
                const min = grid.indexOf(Math.min.apply(0, grid));
                const x = leftWidth * min;
                const itemHeight = items[i].offsetHeight;
                const y = grid[min];
                grid[min] += itemHeight + marginHeight;
                Object.assign(items[i].style, {
                    width: `calc(100% / ${gridSize} - ${marginWidth}px)`,
                    opacity: '1',
                    display: 'block',
                    position: 'absolute',
                    transform: `translate(${x}px, ${y}px)`,
                    visibility: 'visible'
                });
            }
            const max = Math.max.apply(0, grid);
            ref.current.style.height = max + 'px';
        }
    };

    useEffect(() => {
        buildMasonryLayout();

        const event = optimizeEvent(buildMasonryLayout);
        window.addEventListener('resize', event);
        return () => window.removeEventListener('resize', event);
    }, [ref, items]);

    return (
        <div ref={ref} className={cn('masonry')} style={{ height: 390 * items.length }}>
            {items.map((item, index) => (
                <div key={index} className={cn('item')}>
                    {item}
                </div>
            ))}
        </div>
    );
}
