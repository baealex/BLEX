import classNames from 'classnames/bind';
import styles from './ArticleCard.module.scss';
const cn = classNames.bind(styles);

import Link from 'next/link';
import { useMemo } from 'react';

import {
    Card,
    Text
} from '@design-system';

import {
    getPostsImage,
    getUserImage
} from '~/modules/utility/image';
import { unescape } from '~/modules/utility/string';

export interface ArticleCardProps {
    number?: number;
    author?: string;
    url: string;
    image?: string;
    title: string;
    description?: string;
    authorImage?: string;
    createdDate?: string;
    readTime?: number;
    isAd?: boolean;
    className?: string;
    children?: JSX.Element;
    hasShadow?: boolean;
    isRounded?: boolean;
    highlight?: string;
}

export function ArticleCard(props: ArticleCardProps) {
    const {
        hasShadow = true,
        isRounded = true
    } = props;

    const url = props.author ? `/@${props.author}/${props.url}` : props.url;

    const title = useMemo(() => {
        return props.highlight
            ? props.title.replace(new RegExp(props.highlight, 'gi'), (match) => `<mark>${match}</mark>`)
            : props.title;
    }, [props.highlight, props.title]);
    const description = useMemo(() => {
        return props.highlight
            ? props.description?.replace(new RegExp(props.highlight, 'gi'), (match) => `<mark>${match}</mark>`)
            : props.description;
    }, [props.description, props.highlight]);

    return (
        <article className={props.className}>
            <Card
                hasShadow={hasShadow}
                isRounded={isRounded}
                className={cn('posts')}>
                <>
                    {props.image && (
                        <Link href={url}>
                            <img
                                className={cn('image', 'lazy')}
                                alt={props.title}
                                src={getPostsImage(props.image, {
                                    preview: true,
                                    title: props.title
                                })}
                                data-src={getPostsImage(props.image, {
                                    minify: true,
                                    title: props.title
                                })}
                            />
                        </Link>
                    )}
                    <div className="p-3">
                        {props.number && (
                            <div className={cn('number')}>
                                {`${('0' + props.number).slice(-2)}.`}
                            </div>
                        )}
                        <Link href={url}>
                            {title && props.highlight ? (
                                <h3
                                    className={cn('title', 'deep-dark', 'mb-2')}
                                    dangerouslySetInnerHTML={{ __html: title }}
                                />
                            ) : (
                                <Text
                                    tag="h3"
                                    fontWeight={600}
                                    className={cn('title', 'deep-dark', 'mb-2')}>
                                    {props.title}
                                </Text>
                            )}
                            {description && props.highlight ? (
                                <p
                                    className={cn('description', 'shallow-dark', 'mb-3')}
                                    dangerouslySetInnerHTML={{ __html: description }}
                                />
                            ) : (
                                <Text className={cn('description', 'shallow-dark', 'mb-3')}>
                                    {unescape(description || '')}
                                </Text>
                            )}
                        </Link>
                        {props.author && (
                            <div className="d-flex align-items-center justify-content-between">
                                <div className="d-flex align-items-center">
                                    <Link href="/[author]" as={`/@${props.author}`}>
                                        <img
                                            className={cn('author-image')}
                                            alt={props.author}
                                            src={getUserImage(props.authorImage || '')}
                                            width="35"
                                            height="35"
                                        />
                                    </Link>
                                    <div className="vs mx-2">
                                        <Link className="deep-dark" href="/[author]" as={`/@${props.author}`}>
                                            {props.author}
                                        </Link>님이 작성함
                                        <br />
                                        {props.createdDate} · <span className="shallow-dark">{props.readTime} min read</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            </Card>
        </article>
    );
}
