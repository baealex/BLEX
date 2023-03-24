import classNames from 'classnames';
import styles from './ArticleCardSmall.module.scss';

import Link from 'next/link';

import { Card } from '@design-system';

import { getPostsImage } from '~/modules/utility/image';

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
        <div className="col-md-4 mt-3">
            <Card hasShadow isRounded>
                <Link className="deep-dark" href={`/@${props.author}/${props.url}`}>
                    <img
                        className={classNames(
                            styles.image,
                            'lazy'
                        )}
                        src={getPostsImage(props.image, {
                            preview: true,
                            title: props.title
                        })}
                        data-src={getPostsImage(props.image, {
                            minify: true,
                            title: props.title
                        })}
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
        </div>
    );
}
