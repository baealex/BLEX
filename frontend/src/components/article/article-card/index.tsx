import styles from './ArticleCard.module.scss';
import classNames from 'classnames';

import Link from 'next/link';

import { Card } from '@components/atoms';
import {
    getPostsImage,
    getUserImage,
} from '@modules/image';

export interface ArticleCardProps {
    author: string;
    url: string;
    image: string;
    title: string;
    description?: string;
    authorImage: string;
    createdDate: string;
    readTime: number;
}

export function ArticleCard(props: ArticleCardProps) {

    return (
        <div className="col-lg-4 col-md-6 mt-4">
            <Card isRounded>
                <div className={classNames(
                    styles.posts
                )}>
                    <Link href="/[author]/[posturl]" as={`/@${props.author}/${props.url}`}>
                        <a> 
                            <img
                                className={classNames(
                                    styles.postsImage,
                                    'lazy'
                                )}
                                src={getPostsImage(props.image) + '.preview.jpg'}
                                data-src={getPostsImage(props.image)}
                            />
                        </a>
                    </Link>
                </div>
                <div className="p-2">
                    <Link href="/[author]/[posturl]" as={`/@${props.author}/${props.url}`}>
                        <a className="deep-dark">
                            <div className={`${styles.postsTitle} noto mt-3`}>
                                {props.title}
                            </div>
                            <p className="noto">{props.description}</p>
                        </a>
                    </Link>
                    <div className="d-flex">
                        <Link href="/[author]" as={`/@${props.author}`}>
                            <a>
                                <img
                                    className="fit-cover rounded"
                                    src={getUserImage(props.authorImage)}
                                    width="35"
                                    height="35"
                                />
                            </a>
                        </Link>
                        <div className="vs noto mx-2">
                            <Link href="/[author]" as={`/@${props.author}`}><a className="deep-dark">{props.author}</a></Link>님이 작성함<br/>{props.createdDate} · <span className="shallow-dark">{props.readTime} min read</span>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    )
}