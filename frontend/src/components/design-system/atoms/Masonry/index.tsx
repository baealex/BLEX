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
    columnGap?: number;
    rowGap?: number;
    initialHeight?: number;
}

export const Masonry = memo(function Masonry({
    children,
    rowGap = 16,
    columnGap = 16,
    initialHeight
}: MasonryProps) {
    const ref = useRef<HTMLDivElement>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const itemRefs = useRef<Map<number, HTMLElement>>(new Map());

    const getGridSize = useCallback((containerWidth: number): number => {
        if (containerWidth > 1024) return 3;
        if (containerWidth > 768) return 2;
        return 1;
    }, []);

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
                }}>
                {item}
            </div>
        ));
    }, [children]);

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

                Object.assign(item.style, {
                    width: `calc(100% / ${gridSize} - ${columnGap * (gridSize - 1) / gridSize}px)`,
                    display: 'block',
                    position: 'absolute',
                    transform: `translate3d(${x}px, ${y}px, 0)`
                });
            });

            const maxHeight = Math.max(...grid) - rowGap;
            container.style.height = `${maxHeight}px`;
        } catch (error) {
            if (ref.current) {
                ref.current.style.height = 'auto';
            }
        }
    }, [columnGap, rowGap, getGridSize]);

    useEffect(() => {
        const container = ref.current;
        if (!container) return;
        const setupLayout = () => {
            setTimeout(buildMasonryLayout, 100);
            const images = container.querySelectorAll('img');
            let loadedImages = 0;

            const imageLoadHandler = () => {
                loadedImages++;
                if (loadedImages === images.length) {
                    buildMasonryLayout();
                }
            };

            images.forEach(img => {
                if (img.complete) {
                    imageLoadHandler();
                } else {
                    img.addEventListener('load', imageLoadHandler);
                    img.addEventListener('error', imageLoadHandler);
                }
            });

            if (images.length === 0) {
                buildMasonryLayout();
            }
        };

        setupLayout();

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

            if (container) {
                const images = container.querySelectorAll('img');
                images.forEach(img => {
                    img.removeEventListener('load', buildMasonryLayout);
                    img.removeEventListener('error', buildMasonryLayout);
                });
            }
        };
    }, [buildMasonryLayout]);

    return (
        <div
            ref={ref}
            style={{
                height: initialHeight || 390 * children.length,
                position: 'relative'
            }}>
            {itemElements}
        </div>
    );
});

export default Masonry;
