import classNames from 'classnames/bind';
import styles from './PopOver.module.scss';
const cn = classNames.bind(styles);

import { useState } from 'react';

export interface PopOverProps {
    text: string;
    children: React.ReactNode;
}

export function PopOver(props: PopOverProps) {
    const [ hover, setHover ] = useState(false);

    return (
        <div>
            <div className={cn('popover', {
                hover 
            })}>
                {props.text}
            </div>
            <div
                onMouseOver={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
            >
                {props.children}
            </div>
        </div>
    );
}