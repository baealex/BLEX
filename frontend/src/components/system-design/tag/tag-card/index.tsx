import classNames from 'classnames/bind';
import styles from './TagCard.module.scss';
const cn = classNames.bind(styles);

import Link from 'next/link';

import { Card } from '@components/design-system';

export interface TagCardProps {
    name: string;
    count: number;
}

export function TagCard(props: TagCardProps) {
    return (
        <Card hasBackground isRounded className={cn('mt-3 p-3', 'card')}>
            <Link href={`/tags/${props.name}`}>
                <a>
                    ({props.count}) {props.name}
                </a>
            </Link>
        </Card>
    );
}