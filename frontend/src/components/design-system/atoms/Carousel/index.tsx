import classNames from 'classnames/bind';
import styles from './Carousel.module.scss';
const cn = classNames.bind(styles);

import {
    useEffect,
    useState
} from 'react';
import blexer from '~/modules/utility/blexer';

export interface CarouselProps {
    time?: number;
    items: React.ReactNode[];
}

export function Carousel({ items, time=6000 }: CarouselProps) {
    const [focus, setFocus] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setFocus((prevFocus) => {
                if (prevFocus < items.length - 1) return prevFocus + 1;
                return 0;
            });
        }, time);

        return () => clearInterval(interval);
    }, [time]);

    return (
        <div className={cn('carousel')}>
            {items.map((item, idx) => (
                <Item key={idx} item={item} focus={focus}/>
            ))}
        </div>
    );
}

interface ItemProps {
    item: React.ReactNode;
    focus: number;
}

function Item({
    item,
    focus
}: ItemProps) {
    return (
        <>
            {typeof item === 'string' ? (
                <span
                    dangerouslySetInnerHTML={{ __html: blexer(item) }}
                />
            ) : (
                <span>{item}</span>
            )}
            <style jsx>{`
                span {
                    display: block;
                    height: 30px;
                    transition: transform 0.5s ease;
                    transform: translateY(${`-${focus * 100}%`});
                }
            `}</style>
        </>
    );
}
