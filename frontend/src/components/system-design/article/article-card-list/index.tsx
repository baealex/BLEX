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
        <article className={cn('list')}>
            <Link href="/[author]/[posturl]" as={`/@${props.author}/${props.url}`}>
                {props.image && (
                    <img
                        className="lazy mt-4"
                        src={getPostsImage(props.image, { preview: true })}
                        data-src={getPostsImage(props.image, { minify: true })}
                        height="400"
                    />
                )}
            </Link>
            <Text tag="h3" className="mt-4 mb-2" fontWeight={700} fontSize={8}>
                <Link className="deep-dark" href="/[author]/[posturl]" as={`/@${props.author}/${props.url}`}>
                    {props.title}
                </Link>
            </Text>
            <Text className="my-2" fontSize={4}>
                <Link className="shallow-dark" href="/[author]/[posturl]" as={`/@${props.author}/${props.url}`}>
                    {unescape(props.description)}
                </Link>
            </Text>
            <Text className="my-2" fontSize={2}>
                {props.createdDate} · <span className="shallow-dark">{props.readTime} min read</span>
            </Text>
            <TagBadges
                items={props.tags.map(item => (
                    <Link href={`/@${props.author}/posts/${item}`}>
                        {item}
                    </Link>
                ))}
            />
        </article>
    );
}
