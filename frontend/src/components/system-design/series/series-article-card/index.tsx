import classNames from 'classnames/bind';
import styles from './SeriesArticleCard.module.scss';
const cn = classNames.bind(styles);

import Link from 'next/link';

import { getPostsImage } from '@modules/utility/image';
import { unescape } from '@modules/utility/string';

export interface SeriesArticleCardProps {
    idx: number;
    author: string;
    url: string;
    title: string;
    image: string;
    description: string;
    createdDate: string;
    readTime: number;
}

export function SeriesArticleCard(props: SeriesArticleCardProps) {
    return (
        <div className={cn('box')}>
            <Link href={`/@${props.author}/${props.url}`}>
                <a>
                    <img
                        className={cn('thumbnail', 'lazy')}
                        src={getPostsImage(props.image, { preview: true })}
                        data-src={getPostsImage(props.image, { minify: true })}
                    />
                    <div className={cn('mask')}>
                        <div className={cn('title')}>
                            {props.idx + 1}. {props.title}
                        </div>
                        <div className={cn('describe')}>
                            {unescape(props.description)}
                        </div>
                    </div>
                </a>
            </Link>
        </div>
    );
}
