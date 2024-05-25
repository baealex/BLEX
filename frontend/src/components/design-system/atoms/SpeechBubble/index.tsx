import classNames from 'classnames/bind';
import styles from './SpeechBubble.module.scss';
const cx = classNames.bind(styles);

import React from 'react';

interface SpeechBubbleProps {
    image: React.ReactNode;
    className?: string;
    children: React.ReactNode;
}

export function SpeechBubble({
    className,
    image,
    children
}: SpeechBubbleProps) {
    return (
        <div className={cx('box', className)}>
            <blockquote>
                {children}
            </blockquote>
            <div className={cx('user')}>
                {image}
            </div>
        </div>
    );
}
