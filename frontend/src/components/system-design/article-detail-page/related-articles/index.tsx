import classNames from 'classnames/bind';
import styles from './ArticleList.module.scss';
const cn = classNames.bind(styles);

import Link from 'next/link';
import { useRef } from 'react';

import { Text } from '@design-system';

import * as API from '~/modules/api';
import { getPostsImage } from '~/modules/utility/image';
import { useFetch } from '~/hooks/use-fetch';

export interface RelatedProps {
    author: string;
    url: string;
    bio: string;
    name: string;
}

export function RelatedArticles(props: RelatedProps) {
    const ref = useRef<HTMLDivElement>(null);

    const { data: posts } = useFetch([
        'posts',
        'related',
        props.author,
        props.url
    ], async () => {
        const { data } = await API.getFeaturePosts('@' + props.author, props.url);
        return data.body.posts;
    }, { observeRef: ref });

    return (
        <div ref={ref} className="pt-1 reverse-color">
            {posts && posts.map((item) => (
                <div key={item.url} className={cn('list')}>
                    <div className={cn('image')}>
                        <Link href="/[author]/[posturl]" as={`/@${item.author}/${item.url}`}>
                            {item.image && (
                                <img
                                    className="lazy mt-4"
                                    src={getPostsImage(item.image, { preview: true })}
                                    data-src={getPostsImage(item.image, { minify: true })}
                                    height="400"
                                />
                            )}
                        </Link>
                    </div>
                    <div>
                        <Text tag="h3" className="mt-4 mb-2" fontSize={7} fontWeight={700}>
                            <Link className="deep-dark" href="/[author]/[posturl]" as={`/@${item.author}/${item.url}`}>
                                {item.title}
                            </Link>
                        </Text>
                        <Text className="my-2" fontSize={2}>
                            {item.createdDate} · <span className="shallow-dark">{item.readTime} min read</span>
                        </Text>
                    </div>
                </div>
            ))}
        </div>
    );
}
