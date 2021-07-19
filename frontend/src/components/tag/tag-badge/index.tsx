import styles from './TagBadge.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import Link from 'next/link';

export interface TagBadgeProps {
    author: string;
    tags: string[];
}

export function TagBadge(props: TagBadgeProps) {
    return (
        <ul className={classNames(cn('items', 'gothic'))}>
            {props.tags.map((item, idx) => (
                item != '' && (
                    <li key={idx}>
                        <Link href="/[author]/posts/[tag]" as={`/@${props.author}/posts/${item}`}>
                            <a>{item}</a>
                        </Link>
                    </li>
                )
            ))}
        </ul>
    );
}