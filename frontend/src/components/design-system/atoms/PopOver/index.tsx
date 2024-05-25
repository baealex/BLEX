import classNames from 'classnames/bind';
import styles from './PopOver.module.scss';
const cx = classNames.bind(styles);

import { useEffect, useRef, useState } from 'react';

export interface PopOverProps {
    text: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
    children: React.ReactNode;
}

export function PopOver({
    position = 'left',
    ...props
}: PopOverProps) {
    const popOverRef = useRef<HTMLDivElement>(null);
    const childrenRef = useRef<HTMLDivElement>(null);

    const [hover, setHover] = useState(false);

    useEffect(() => {
        if (popOverRef.current && childrenRef.current) {
            const { current: popOver } = popOverRef;
            const { current: children } = childrenRef;

            const childrenRect = children.getBoundingClientRect();
            const popOverRect = popOver.getBoundingClientRect();

            if (position === 'top') {
                const x = (childrenRect.width - popOverRect.width) / 2;
                const y = -(popOverRect.height + 16);
                popOver.style.transform = `translate(${x}px, ${y}px)`;
            }

            if (position === 'bottom') {
                const x = (childrenRect.width - popOverRect.width) / 2;
                const y = childrenRect.height + 16;
                popOver.style.transform = `translate(${x}px, ${y}px)`;
            }

            if (position === 'left') {
                const x = -(popOverRect.width + 16);
                popOver.style.transform = `translate(${x}px, 0)`;
            }

            if (position === 'right') {
                const x = childrenRect.width + 16;
                popOver.style.transform = `translate(${x}px, 0)`;
            }
        }
    }, [hover, position]);

    return (
        <div>
            <div
                ref={popOverRef}
                className={cx('popover', position, { hover })}>
                {props.text}
            </div>
            <span
                ref={childrenRef}
                onMouseOver={() => setHover(true)}
                onMouseLeave={() => setHover(false)}>
                {props.children}
            </span>
        </div>
    );
}
