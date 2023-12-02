import classNames from 'classnames/bind';
import styles from './TagCard.module.scss';
const cn = classNames.bind(styles);

import Link from 'next/link';

import { Card, Text } from '@design-system';
import { getPostsImage } from '~/modules/utility/image';

export interface TagCardProps {
    name: string;
    count: number;
    image?: string;
    description: string;
}

export function TagCard(props: TagCardProps) {
    return (
        <Card hasBackground isRounded className={cn('card')}>
            {props.image && (
                <Link href={`/tags/${props.name}`}>
                    <img
                        className={cn('card-image', 'lazy')}
                        src={getPostsImage(props.image, { preview: true })}
                        data-src={getPostsImage(props.image)}
                        alt={props.name}
                    />
                </Link>
            )}
            <div className="p-3 pt-0">
                <Link href={`/tags/${props.name}`}>
                    <Text className="deep-dark" fontSize={4} fontWeight={600}>
                        ({props.count}) {props.name}
                    </Text>
                </Link>
                {props.description && (
                    <Link href={`/tags/${props.name}`}>
                        <Text className="mt-1 shallow-dark" fontSize={3}>
                            {props.description}
                        </Text>
                    </Link>
                )}
            </div>
        </Card>
    );
}
