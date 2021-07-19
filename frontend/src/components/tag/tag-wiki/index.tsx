import styles from './TagWiki.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import Link from 'next/link';

export interface TagWikiProps {
    url: string;
    author: string;
    description: string;
}

export function TagWiki(props: TagWikiProps) {
    return (
        <div className={classNames(
            cn('description'), 'gothic mt-4',
        )}>
            <Link href="/[author]/[posturl]" as={`/@${props.author}/${props.url}`}>
                <a>{props.description}</a>
            </Link>
            <Link href="/[author]" as={`/@${props.author}`}>
                <a className={cn('author')}>@{props.author}</a>
            </Link>
        </div>
    )
}