import classNames from 'classnames/bind';
import styles from './ArticleCard.module.scss';
const cx = classNames.bind(styles);

import Link from 'next/link';
import { useMemo } from 'react';

import {
    Flex,
    LazyLoadedImage,
    Text
} from '~/components/design-system';

import {
    getPostImage,
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
        <div>
            <Flex className="mb-3" align="center" justify="between">
                <Flex align="center" gap={1}>
                    {props.author && (
                        <Link className="deep-dark" href={`/@${props.author}`}>
                            <Flex align="center" gap={1}>
                                <img
                                    className={cx('author-image')}
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
                <Flex align="center" gap={3} className={cx('actions')}>
                    {typeof props.countComments === 'number' && (
                        <button className={cx('action')} onClick={() => router.push(url + '#comments')}>
                            <Flex align="center" gap={1}>
                                <i className="far fa-comment" />
                                <Text>{props.countComments}</Text>
                            </Flex>
                        </button>
                    )}
                    {typeof props.countLikes === 'number' && (
                        <button className={cx('action', 'like', { active: props.hasLiked })} onClick={props.onLike}>
                            <Flex align="center" gap={1}>
                                {props.hasLiked
                                    ? <i className="fas fa-heart" />
                                    : <i className="far fa-heart" />}
                            </Flex>
                        </button>
                    )}
                </Flex>
            </Flex>
            <div className={cx('posts')}>
                <>
                    {props.image && (
                        <Link href={url} className={cx('image')}>
                            <LazyLoadedImage
                                className={cx('image')}
                                alt={props.title}
                                src={getPostImage(props.image, { minify: true })}
                                previewImage={getPostImage(props.image, { preview: true })}
                            />
                        </Link>
                    )}
                    <Flex className={cx('content')} direction="column">
                        <div className="w-100">
                            <div className="py-2">
                                {props.number && (
                                    <div className={cx('number')}>
                                        {`${('0' + props.number).slice(-2)}.`}
                                    </div>
                                )}
                                <Link href={url}>
                                    {title && props.highlight ? (
                                        <h3
                                            className={cx('title', 'deep-dark', 'mb-2')}
                                            dangerouslySetInnerHTML={{ __html: title }}
                                        />
                                    ) : (
                                        <Text
                                            tag="h3"
                                            fontWeight={600}
                                            className={cx('deep-dark', 'mb-2')}>
                                            {props.title}
                                        </Text>
                                    )}
                                    {description && props.highlight ? (
                                        <p
                                            className={cx('description', 'shallow-dark')}
                                            dangerouslySetInnerHTML={{ __html: description }}
                                        />
                                    ) : (
                                        <Text className={cx('description', 'shallow-dark')}>
                                            {unescape(description || '')}
                                        </Text>
                                    )}
                                </Link>
                            </div>
                        </div>
                    </Flex>
                </>
            </div>
        </div>
    );
}
