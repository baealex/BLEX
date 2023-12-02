import classNames from 'classnames/bind';
import styles from './TagCard.module.scss';
const cn = classNames.bind(styles);

import Link from 'next/link';

import { Card, Text } from '@design-system';

export interface TagCardProps {
    name: string;
    count: number;
    description: string;
}

export function TagCard(props: TagCardProps) {
    return (
        <Card hasBackground isRounded className={cn('p-3', 'card')}>
            <Link href={`/tags/${props.name}`}>
                ({props.count}) {props.name}
            </Link>
            {props.description && (
                <Link href={`/tags/${props.name}`}>
                    <Text className="mt-1 shallow-dark" fontSize={3}>
                        {props.description}
                    </Text>
                </Link>
            )}
        </Card>
    );
}
