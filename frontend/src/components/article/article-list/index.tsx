import styles from './ArticleList.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import Link from 'next/link';

import { TagBadge } from '@components/tag';

import { getPostsImage } from '@modules/image';

export interface ArticleListProps {
    url: string;
    title: string;
    image: string;
    author: string;
    createdDate: string;
    description: string;
    readTime: number;
    tag: string;
}

export function ArticleList(props: ArticleListProps) {
    return (
        <div className={cn('list')}>
            <Link href="/[author]/[posturl]" as={`/@${props.author}/${props.url}`}>
                <a>
                    {props.image && (
                        <img
                            className="lazy"
                            src={getPostsImage(props.image) + '.preview.jpg'}
                            data-src={getPostsImage(props.image)}
                            height="400"
                        />
                    )}
                </a>
            </Link>
            <h4 className="card-title font-weight-bold mt-3">
                <Link href="/[author]/[posturl]" as={`/@${props.author}/${props.url}`}>
                    <a className="deep-dark">
                        {props.title}
                    </a>
                </Link>
            </h4>
            <p>
                <Link href="/[author]/[posturl]" as={`/@${props.author}/${props.url}`}>
                    <a className="shallow-dark">
                        {props.description}
                    </a>
                </Link>
            </p>
            <p className="vs">{props.createdDate} · <span className="shallow-dark">{props.readTime} min read</span></p>
            <TagBadge author={props.author} tags={props.tag.split(',')}/>
        </div>
    )
}