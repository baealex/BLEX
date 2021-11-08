import styles from './Flip.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import {
    useEffect,
    useRef,
} from 'react';

export interface FlipProps {
    block?: boolean;
}

export function Flip({
    block=false
}: FlipProps) {
    const item1 = useRef<HTMLDivElement>(null);
    const item2 = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const emoji = [
            '😃', '😅', '😉', '😍', '😎', '😟', '😣', '😨' ,'😥', '🤗', '🤔'
        ];

        let prevPick = 0

        const changeEmoji = (element: HTMLDivElement | null) => {
            if (!element) {
                return;
            }

            let pick = 0;
            do {
                pick = Math.floor(Math.random() * emoji.length)
            } while(prevPick == pick);
            prevPick = pick
            element.textContent = emoji[pick]
        }
        
        const events: NodeJS.Timeout[] = [];

        events.push(setTimeout(() => {
            changeEmoji(item1.current)

            events.push(setInterval(() => {
                changeEmoji(item1.current)
            }, 2000));
        }, 500));

        events.push(setTimeout(() => {
            changeEmoji(item2.current)
            
            events.push(setInterval(() => {
                changeEmoji(item2.current)
            }, 2000));
        }, 1500));

        return () => events.forEach(item => {
            clearTimeout(item);
            clearInterval(item);
        })
    }, []);

    return (
        <div className={cn({ block })}>
            <div className={cn('fliper')}>
                <div ref={item1} className={cn('f')}>😃</div>
                <div ref={item2} className={cn('s')}>😢</div>
            </div>
        </div>
    )
}