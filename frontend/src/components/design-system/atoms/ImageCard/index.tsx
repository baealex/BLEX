import classNames from 'classnames/bind';
import styles from './ImageCard.module.scss';
const cn = classNames.bind(styles);

import { createColorHash } from '~/modules/utility/image';
import { useMemo } from 'react';

export interface ImageCardProps {
    image?: React.ReactNode;
    bgHash: string;
    children: React.ReactNode;
}

export function ImageCard(props: ImageCardProps) {
    const colorHash = useMemo(() => createColorHash(props.bgHash), [props.bgHash]);

    return (
        <div
            className={cn('card')}
            style={{ backgroundColor: colorHash }}>
            <div className={cn('card-image')}>
                {props.image}
            </div>
            <div className={cn('card-body')}>
                {props.children}
            </div>
        </div>
    );
}
