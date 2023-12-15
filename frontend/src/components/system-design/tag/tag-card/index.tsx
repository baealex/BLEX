import classNames from 'classnames/bind';
import styles from './TagCard.module.scss';
const cn = classNames.bind(styles);

import Link from 'next/link';

import { Text } from '@design-system';
import { getPostsImage } from '~/modules/utility/image';
import { useMemo } from 'react';

export interface TagCardProps {
    name: string;
    count: number;
    image?: string;
}

const createColorHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
};

export function TagCard(props: TagCardProps) {
    const colorHash = useMemo(() => createColorHash(props.name), [props.name]);

    return (
        <Link className={cn('white')} href={`/tags/${props.name}`}>
            <div className={cn('card')} style={{ backgroundColor: colorHash }}>
                {props.image && (
                    <img
                        className={cn('card-image', 'lazy')}
                        src={getPostsImage(props.image, { preview: true })}
                        data-src={getPostsImage(props.image)}
                        alt={props.name}
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
