import classNames from 'classnames/bind';
import styles from './Masonry.module.scss';
const cn = classNames.bind(styles);

import { useEffect, useRef } from 'react';

interface MasonryProps {
    items: React.ReactNode[];
}

export function Masonry({ items }: MasonryProps) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!ref.current) {
            return;
        }

        if (typeof window === 'undefined') {
            return;
        }

        import('masonry-layout').then(({ default: MasonryLayout }) => {
            new MasonryLayout(ref.current!, {
                itemSelector: '.' + cn('item'),
                gutter: 16,
                percentPosition: true
            });
        });
    }, [ref, items]);

    return (
        <div ref={ref} className={cn('masonry')}>
            {items.map((item, index) => (
                <div key={index} className={cn('item')}>
                    {item}
                </div>
            ))}
        </div>
    );
}
