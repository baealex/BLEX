import classNames from 'classnames/bind';
import styles from './Alert.module.scss';
const cx = classNames.bind(styles);

import React from 'react';

export interface AlertProps {
    type?: 'default' | 'danger' | 'warning' | 'information' | 'success';
    onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
    children?: React.ReactNode;
    className?: string;
}

export function Alert(props: AlertProps) {
    return (
        <div
            onClick={props.onClick}
            className={cx(
                'alert',
                props.type,
                { canClick: props.onClick }
            ) + `${props.className ? ` ${props.className}` : ''}`}>
            {props.children}
        </div>
    );
}
