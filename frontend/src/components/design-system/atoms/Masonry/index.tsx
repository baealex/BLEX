import { handyDom } from '@baejino/handy';
import {
    useEffect,
    useRef,
    useCallback,
    useMemo,
    memo
} from 'react';
import { optimizeEvent } from '~/modules/optimize/event';

interface MasonryProps {
    children: React.ReactNode[];
    gridSize: Record<number, number>;
    rowGap?: number;
    columnGap?: number;
    itemMaxHeight?: number;
}

export const Masonry = memo(function Masonry({
    children,
    rowGap = 16,
    columnGap = 16,
    gridSize,
    itemMaxHeight = 0
}: MasonryProps) {
    const ref = useRef<HTMLDivElement>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const itemRefs = useRef<Map<number, HTMLElement>>(new Map());

    const getGridSize = (containerWidth: number) => {
        const keys = Object.keys(gridSize).map(Number).sort((a, b) => b - a);
        for (const key of keys) {
            if (containerWidth >= key) {
                return gridSize[key];
            }
        }
        return gridSize[keys[keys.length - 1]];
    };

    const itemElements = useMemo(() => {
        return children.map((item, index) => (
            <div
                key={index}
                ref={(el) => {
                    if (el) {
                        itemRefs.current.set(index, el);
                    } else {
                        itemRefs.current.delete(index);
                    }
                }}
                style={{
                    position: 'absolute',
                    width: '0'
                }}>
                {item}
            </div>
        ));
    }, [children, columnGap]);

    const buildMasonryLayout = useCallback(() => {
        const container = ref.current;
        if (!container) return;

        try {
            const containerWidth = container.offsetWidth;
            const gridSize = getGridSize(containerWidth);
            const itemElements = Array.from(itemRefs.current.values());

            const grid = new Array(gridSize).fill(0);
            const leftWidth = containerWidth / gridSize;

            itemElements.forEach(item => {
                const minHeightColumn = grid.indexOf(Math.min(...grid));
                const x = leftWidth * minHeightColumn;
                const y = grid[minHeightColumn];

                const itemHeight = item.offsetHeight;
                grid[minHeightColumn] += itemHeight + rowGap;

                handyDom.setStyles(item, {
                    width: `calc(100% / ${gridSize} - ${columnGap * (gridSize - 1) / gridSize}px)`,
                    top: `${y}px`,
                    left: `${x}px`
                });
            });

            handyDom.setStyles(container, { minHeight: `${Math.max(...grid) - rowGap}px` });
        } catch (error) {
            if (ref.current) {
                handyDom.setStyles(ref.current, { minHeight: 'auto' });
            }
        }
    }, [columnGap, rowGap, itemElements]);

    useEffect(() => {
        const container = ref.current;
        if (!container) return;

        buildMasonryLayout();

        const debouncedBuild = optimizeEvent(buildMasonryLayout);
        resizeObserverRef.current = new ResizeObserver((entries) => {
            if (entries.length > 0) {
                debouncedBuild();
            }
        });
        resizeObserverRef.current.observe(container);

        window.addEventListener('resize', debouncedBuild);

        return () => {
            if (resizeObserverRef.current) {
                resizeObserverRef.current.disconnect();
            }
            window.removeEventListener('resize', debouncedBuild);
        };
    }, [buildMasonryLayout]);

    return (
        <div
            ref={ref}
            style={{
                position: 'relative',
                minHeight: children.length / getGridSize(ref.current?.offsetWidth || 0) * itemMaxHeight
            }}>
            {itemElements}
        </div>
    );
});

export default Masonry;
