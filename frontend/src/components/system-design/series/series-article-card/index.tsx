import classNames from 'classnames/bind';
import styles from './SeriesArticleCard.module.scss';
const cn = classNames.bind(styles);

import Link from 'next/link';

import { Card } from '@design-system';

import { getPostsImage } from '~/modules/utility/image';
import { unescape } from '~/modules/utility/string';

export interface SeriesArticleCardProps {
    number: number;
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
        <Card hasBackground hasShadow backgroundType="background" className={cn('box')}>
            <Link href={`/@${props.author}/${props.url}`}>
                <div className={cn('title')}>
                    {('000' + props.number).slice(-3)}. {props.title}
                </div>
                <div className={cn('date')}>
                    {props.createdDate}
                </div>
                <div className={cn('description')}>
                    {unescape(props.description)}
                </div>
                {props.image && (
                    <img
                        className={cn('thumbnail', 'lazy')}
                        src={getPostsImage(props.image, { preview: true })}
                        data-src={getPostsImage(props.image, { minify: true })}
                    />
                )}
                <span className="shallow-dark">
                    더보기
                </span>
            </Link>
        </Card>
    );
}
