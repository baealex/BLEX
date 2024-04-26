import classNames from 'classnames/bind';
import styles from './ArticleCardSmall.module.scss';
const cx = classNames.bind(styles);

import Link from 'next/link';

import { Card, LazyLoadedImage } from '@design-system';

import { getDefaultPostCoverImage, getPostImage } from '~/modules/utility/image';

export interface ArticleCardSmallProps {
    author: string;
    url: string;
    title: string;
    image: string;
    createdDate: string;
    readTime: number;
}

export function ArticleCardSmall(props: ArticleCardSmallProps) {
    return (
        <Card hasShadow isRounded>
            <Link className="deep-dark" href={`/@${props.author}/${props.url}`}>
                <LazyLoadedImage
                    alt={props.title}
                    className={cx('image')}
                    src={props.image
                        ? getPostImage(props.image, { minify: true })
                        : getDefaultPostCoverImage(props.title)}
                    previewImage={props.image
                        ? getPostImage(props.image, { preview: true })
                        : getDefaultPostCoverImage(props.title)}
                />
                <div className="p-3">
                    <div className={styles.title}>
                        {props.title}
                    </div>
                    <div className="vs mt-2">
                        {props.createdDate} · <span className="shallow-dark">{props.readTime} min read</span>
                    </div>
                </div>
            </Link>
        </Card>
    );
}
