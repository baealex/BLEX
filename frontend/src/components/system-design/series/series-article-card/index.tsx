import classNames from 'classnames/bind';
import styles from './SeriesArticleCard.module.scss';
const cn = classNames.bind(styles);

import Link from 'next/link';

import { Card, Flex, LazyLoadedImage, Text } from '@design-system';

import { getPostImage } from '~/modules/utility/image';
import { unescape } from '~/modules/utility/string';

export interface SeriesArticleCardProps {
    number: number;
    author: string;
    url: string;
    title: string;
    image: string;
    description: string;
    createdDate: string;
    readTime: number;
}

export function SeriesArticleCard(props: SeriesArticleCardProps) {
    return (
        <Card hasShadow hasBackground backgroundType="background" className="py-4">
            <Flex className={cn('box')} direction="column" gap={3}>
                <Text className="px-4" fontWeight={600}>
                    <Link className={cn('title', 'deep-dark')} href={`/@${props.author}/${props.url}`}>
                        {('000' + props.number).slice(-3)}. {props.title}
                    </Link>
                </Text>
                {props.image && (
                    <Link className="w-100" href={`/@${props.author}/${props.url}`}>
                        <LazyLoadedImage
                            className={cn('thumbnail')}
                            alt={props.title}
                            src={getPostImage(props.image, { minify: true })}
                            previewImage={getPostImage(props.image, { preview: true })}
                        />
                    </Link>
                )}
                <Text className="px-4" fontSize={3}>
                    <Link className={cn('description', 'deep-dark')} href={`/@${props.author}/${props.url}`}>
                        {unescape(props.description)}
                    </Link>
                </Text>
                <Flex className="px-4" align="center" gap={1}>
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
            </Flex>
        </Card>
    );
}
