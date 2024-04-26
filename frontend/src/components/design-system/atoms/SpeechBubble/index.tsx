import classNames from 'classnames/bind';
import styles from './SpeechBubble.module.scss';
const cn = classNames.bind(styles);

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
        <div className={cn('box', className)}>
            <blockquote>
                {children}
            </blockquote>
            <div className={cn('user')}>
                {image}
            </div>
        </div>
    );
}
