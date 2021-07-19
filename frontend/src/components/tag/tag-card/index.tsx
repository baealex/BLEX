import styles from './TagCard.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import Link from 'next/link'

export interface TagCardProps {
    name: string;
    count: number;
    description: string;
}

export function TagCard(props: TagCardProps) {
    return (
        <div className="col-12 col-md-6 col-lg-4 mt-5">
            <div className={cn('card')}>
                <div className={classNames(cn('title'), 'gothic')}>
                    <Link href="/tags/[tag]" as={`/tags/${props.name}`}>
                        <a className="shallow-dark">{props.name} ({props.count})</a>
                    </Link>
                </div>
                {props.description ? (
                    <div className="noto ns">
                        <Link href="/tags/[tag]" as={`/tags/${props.name}`}>
                            <a className="gray-dark">{props.description}</a>
                        </Link>
                    </div>
                ) : ''}
            </div>
        </div>
    )
}