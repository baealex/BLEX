import styles from './Alert.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import React from 'react';

export interface AlertProps {
    type?: 'danger' | 'warning' | 'infomation';
    onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
    children?: string;
    className?: string;
}

export function Alert(props: AlertProps) {
    return (
        <div
            onClick={props.onClick}
            className={cn(
                'alert',
                props.type,
                { canClick: props.onClick }
            ) + `${props.className ? ` ${props.className}` : ''}`}
        >
            {props.children}
        </div>
    )
}