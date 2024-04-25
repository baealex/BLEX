import classNames from 'classnames/bind';
import styles from './ArticleCardList.module.scss';
const cn = classNames.bind(styles);

import Link from 'next/link';

import { BadgeGroup, LazyLoadedImage, Text } from '~/components/design-system';

import { getPostImage } from '~/modules/utility/image';
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
        <div>
            <Text fontSize={2} className="mb-3">
                {props.createdDate} · <span className="shallow-dark">{props.readTime}분 분량</span>
            </Text>
            <div className={cn('list')}>
                {props.image && (
                    <Link className={cn('image')} href="/[author]/[posturl]" as={`/@${props.author}/${props.url}`}>
                        <LazyLoadedImage
                            className={cn('image')}
                            alt={props.title}
                            previewImage={getPostImage(props.image, { preview: true })}
                            src={getPostImage(props.image, { minify: true })}
                        />
                    </Link>
                )}
                <div className={cn('content')}>
                    <Text tag="h3" fontWeight={700} fontSize={5}>
                        <Link className="deep-dark" href="/[author]/[posturl]" as={`/@${props.author}/${props.url}`}>
                            {props.title}
                        </Link>
                    </Text>
                    <Text className={cn('description', 'mt-2')} fontSize={4}>
                        <Link className="shallow-dark" href="/[author]/[posturl]" as={`/@${props.author}/${props.url}`}>
                            {unescape(props.description)}
                        </Link>
                    </Text>
                    <BadgeGroup
                        className="mt-3"
                        items={props.tags.map(item => (
                            <Link href={`/@${props.author}/posts/${item}#profile`}>
                                {item}
                            </Link>
                        ))}
                    />
                </div>
            </div>
        </div>
    );
}
