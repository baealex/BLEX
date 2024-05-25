import classNames from 'classnames/bind';
import styles from './Text.module.scss';
const cx = classNames.bind(styles);

import React from 'react';

export interface TextProps {
    children: React.ReactNode;
    className?: string;
    fontSize?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
    fontWeight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
    tag?: 'p' | 'span' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

export function Text(props: TextProps) {
    const {
        tag = 'p',
        fontSize = 4,
        fontWeight = 400
    } = props;

    return React.createElement(
        tag,
        {
            className: cx(
                'text',
                `fs-${fontSize}`,
                `fw-${fontWeight}`,
                props.className
            )
        },
        props.children
    );
}
