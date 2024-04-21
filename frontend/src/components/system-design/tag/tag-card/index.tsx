import classNames from 'classnames/bind';
import styles from './TagCard.module.scss';
const cn = classNames.bind(styles);

import Link from 'next/link';

import { LazyLoadedImage, Text } from '@design-system';
import { createColorHash, getPostImage } from '~/modules/utility/image';
import { useMemo } from 'react';

export interface TagCardProps {
    name: string;
    count: number;
    image?: string;
}


export function TagCard(props: TagCardProps) {
    const colorHash = useMemo(() => createColorHash(props.name), [props.name]);

    return (
        <Link className={cn('white')} href={`/tags/${props.name}`}>
            <div className={cn('card')} style={{ backgroundColor: colorHash }}>
                {props.image && (
                    <LazyLoadedImage
                        className={cn('card-image')}
                        alt={props.name}
                        src={getPostImage(props.image)}
                        previewImage={getPostImage(props.image, { preview: true })}
                    />
                )}
                <div className={cn('card-body', { 'has-image': props.image })}>
                    <Text fontSize={5} fontWeight={600}>
                        ({props.count}) {props.name}
                    </Text>
                </div>
            </div>
        </Link>
    );
}
