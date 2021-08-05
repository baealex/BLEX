import styles from './ArticleCard.module.scss';
import classNames from 'classnames';

import Link from 'next/link';

import { Card } from '@components/atoms';

import {
    getPostsImage,
    getUserImage,
} from '@modules/image';

export interface ArticleCardProps {
    author?: string;
    url: string;
    image: string;
    title: string;
    description?: string;
    authorImage?: string;
    createdDate?: string;
    readTime?: number;
    className?: string;
}

export function ArticleCard(props: ArticleCardProps) {
    const url = props.author ? `/@${props.author}/${props.url}` : props.url;

    return (
        <div className={props.className}>
            <Card isRounded className={styles.posts}>
                <Link href={url}>
                    <a> 
                        <img
                            className={classNames(
                                styles.image,
                                'lazy'
                            )}
                            src={getPostsImage(props.image, { preview: true })}
                            data-src={getPostsImage(props.image, { minify: true })}
                        />
                    </a>
                </Link>
                <div className="p-2">
                    <Link href={url}>
                        <a>
                            <div className={`${styles.title} mt-3 deep-dark`}>
                                {props.title}
                            </div>
                            <p className="shallow-dark">{props.description}</p>
                        </a>
                    </Link>
                    {props.author && (
                        <div className="d-flex">
                            <Link href="/[author]" as={`/@${props.author}`}>
                                <a>
                                    <img
                                        className="fit-cover rounded"
                                        src={getUserImage(props.authorImage || '')}
                                        width="35"
                                        height="35"
                                    />
                                </a>
                            </Link>
                            <div className="vs mx-2">
                                <Link href="/[author]" as={`/@${props.author}`}><a className="deep-dark">{props.author}</a></Link>님이 작성함<br/>{props.createdDate} · <span className="shallow-dark">{props.readTime} min read</span>
                            </div>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    )
}