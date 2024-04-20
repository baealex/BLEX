import classNames from 'classnames/bind';
import styles from './ArticleCard.module.scss';
const cn = classNames.bind(styles);

import Link from 'next/link';
import { useMemo } from 'react';

import {
    Flex,
    Text
} from '@design-system';

import {
    getPostsImage,
    getUserImage
} from '~/modules/utility/image';
import { unescape } from '~/modules/utility/string';
import { useRouter } from 'next/router';

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
    countComments?: number;
    countLikes?: number;
    hasLiked?: boolean;
    onLike?: () => void;
    series?: {
        name: string;
        url: string;
    };
}

export function ArticleCard(props: ArticleCardProps) {
    const router = useRouter();

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
        <article className={cn(props.className, 'w-100', 'mt-2')}>
            <Flex align="center" justify="between">
                <Flex align="center" gap={1}>
                    {props.author && (
                        <Link className="deep-dark" href={`/@${props.author}`}>
                            <Flex align="center" gap={1}>
                                <img
                                    className={cn('author-image')}
                                    alt={props.author}
                                    src={getUserImage(props.authorImage || '')}
                                />
                                <Text fontSize={3}>
                                    @{props.author}
                                </Text>
                            </Flex>
                        </Link>
                    )}
                    <Text fontSize={2} className="shallow-dark">
                        ·
                    </Text>
                    <Text fontSize={2} className="shallow-dark">
                        {props.createdDate}
                    </Text>
                    <Text fontSize={2} className="shallow-dark">
                        ·
                    </Text>
                    <Text fontSize={2} className="shallow-dark">
                        {props.readTime}분 분량
                    </Text>
                </Flex>
                <Flex align="center" gap={3}>
                    {typeof props.countComments === 'number' && (
                        <button className={cn('action')} onClick={() => router.push(url + '#comments')}>
                            <Flex align="center" gap={1}>
                                <i className="far fa-comment" />
                                <Text>{props.countComments}</Text>
                            </Flex>
                        </button>
                    )}
                    {typeof props.countLikes === 'number' && (
                        <button className={cn('action', 'like', { active: props.hasLiked })} onClick={props.onLike}>
                            <Flex align="center" gap={1}>
                                {props.hasLiked
                                    ? <i className="fas fa-heart" />
                                    : <i className="far fa-heart" />}
                            </Flex>
                        </button>
                    )}
                </Flex>
            </Flex>
            <div className={cn('posts')}>
                <>
                    {props.image && (
                        <Link href={url} className={cn('image')}>
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
                    <Flex className={cn('content')} direction="column">
                        <div className="w-100">
                            <div className="py-2">
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
                                            className={cn('description', 'shallow-dark')}
                                            dangerouslySetInnerHTML={{ __html: description }}
                                        />
                                    ) : (
                                        <Text className={cn('description', 'shallow-dark')}>
                                            {unescape(description || '')}
                                        </Text>
                                    )}
                                </Link>
                            </div>
                        </div>
                    </Flex>
                </>
            </div>
        </article>
    );
}
