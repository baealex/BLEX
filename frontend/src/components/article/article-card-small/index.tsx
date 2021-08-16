import styles from './ArticleCardSmall.module.scss';
import classNames from 'classnames';

import Link from 'next/link';

import { Card } from '@components/atoms';

import {
    getPostsImage,
} from '@modules/image';

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
                <Link href="/[author]/[posturl]" as={`@${props.author}/${props.url}`}>
                    <a className="deep-dark">
                        <img
                            className={classNames(
                                styles.image,
                                'lazy'
                            )}
                            src={getPostsImage(props.image, { preview: true })}
                            data-src={getPostsImage(props.image, { minify: true })}
                        />
                        <div className="p-3">
                            <div>
                                {props.title}
                            </div>
                            <div className="vs mt-2">
                                {props.createdDate} · <span className="shallow-dark">{props.readTime} min read</span>
                            </div>
                        </div>
                    </a>
                </Link>
            </Card>
        </div>
    )
}