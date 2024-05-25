import classNames from 'classnames/bind';
import styles from './CapsuleCard.module.scss';
const cx = classNames.bind(styles);

import React from 'react';

import type { Gap } from '~/types/style';

import type { CardProps } from '~/components/design-system';
import { Card } from '~/components/design-system';

interface CapsuleCardProps extends CardProps {
    image: React.ReactNode;
    children: React.ReactNode;
    padding?: Gap;
}

export function CapsuleCard({ image, children, padding = 3, ...rest } : CapsuleCardProps) {
    return (
        <Card {...rest}>
            <div className={cx('image')}>
                {image}
            </div>
            <div className={`p-${padding}`}>
                {children}
            </div>
        </Card>
    );
}
