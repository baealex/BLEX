import classNames from 'classnames/bind';
import styles from './ImageCard.module.scss';
const cx = classNames.bind(styles);

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
        <div className={cx('card')} style={{ backgroundColor: colorHash }}>
            <div className={cx('card-image')}>
                {props.image}
            </div>
            <div className={cx('card-body')}>
                {props.children}
            </div>
        </div>
    );
}
