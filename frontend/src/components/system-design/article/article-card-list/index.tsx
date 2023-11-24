import classNames from 'classnames/bind';
import styles from './ArticleCardList.module.scss';
const cn = classNames.bind(styles);

import Link from 'next/link';

import { TagBadges } from '../../tag';
import { Text } from '~/components/design-system';

import { getPostsImage } from '~/modules/utility/image';
import { unescape } from '~/modules/utility/string';

export interface ArticleCardListProps {
    url: string;
    title: string;
    image: string;
    author: string;
    createdDate: string;
    description: string;
    readTime: number;
    tags: string[];
}

export function ArticleCardList(props: ArticleCardListProps) {
    return (
        <article>
            <div className={cn('list')}>
                {props.image && (
                    <Link className={cn('image')} href="/[author]/[posturl]" as={`/@${props.author}/${props.url}`}>
                        <img
                            className="lazy"
                            src={getPostsImage(props.image, { preview: true })}
                            data-src={getPostsImage(props.image, { minify: true })}
                            height="400px"
                        />
                    </Link>
                )}
                <div className={cn('content')}>
                    <Text tag="h3" fontWeight={700} fontSize={8}>
                        <Link className="deep-dark" href="/[author]/[posturl]" as={`/@${props.author}/${props.url}`}>
                            {props.title}
                        </Link>
                    </Text>
                    <Text className={cn('description', 'mt-2')} fontSize={4}>
                        <Link className="shallow-dark" href="/[author]/[posturl]" as={`/@${props.author}/${props.url}`}>
                            {unescape(props.description)}
                        </Link>
                    </Text>
                    <Text className="mt-2" fontSize={2}>
                        {props.createdDate} · <span className="shallow-dark">{props.readTime} min read</span>
                    </Text>
                    <TagBadges
                        className="mt-3"
                        items={props.tags.map(item => (
                            <Link href={`/@${props.author}/posts/${item}`}>
                                {item}
                            </Link>
                        ))}
                    />
                </div>
            </div>
        </article>
    );
}
