import classNames from 'classnames/bind';
import styles from './TagCard.module.scss';
const cn = classNames.bind(styles);

import Link from 'next/link';

export interface TagCardProps {
    name: string;
    count: number;
}

export function TagCard(props: TagCardProps) {
    return (
        <div className="col-sm-6 col-md-4 col-lg-3 mt-3">
            <div className={cn('card')}>
                <Link href={`/tags/${props.name}`}>
                    <a>
                        ({props.count}) {props.name}
                    </a>
                </Link>
            </div>
        </div>
    );
}