import styles from './Carousel.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import { useState, useEffect } from 'react';

export interface CarouselProps {
    items: JSX.Element[];
}

export function Carousel({
    items
}: CarouselProps) {
    const [ focus, setFocus ] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setFocus((prevFocus) => {
                if (prevFocus < items.length - 1) return prevFocus + 1;
                return 0;
            });
        }, 6000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className={cn('carousel')}>
            {items.map((item, idx) => (
                <Item key={idx} item={item} focus={focus}/>
            ))}
        </div>
    )
}

function Item({
    item,
    focus,
}: any) {
    return (
        <>
            <span>{item}</span>
            <style jsx>{`
                span {
                    display: block;
                    height: 30px;
                    transition: transform 0.5s ease;
                    transform: translateY(${`-${focus * 100}%`});
                }
            `}</style>
        </>
    )
}