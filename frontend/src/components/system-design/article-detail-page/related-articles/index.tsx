import classNames from 'classnames/bind';
import styles from './ArticleList.module.scss';
const cn = classNames.bind(styles);

import Link from 'next/link';
import { useRef } from 'react';

import { SubscribeButton } from '@system-design/shared';
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
        <div ref={ref} className="x-container pt-5 reverse-color">
            <div className="d-flex algin-items-center justify-content-between">
                <div>
                    <Text className="mb-1" fontWeight={600}>
                        <Link href={`/@${props.author}`}>
                            <a className="font-weight-bold deep-dark">
                                {props.name}
                            </a>
                        </Link>
                        님이 작성한 다른 글
                    </Text>
                    <Text className="shallow-dark">
                        {props.bio}
                    </Text>
                </div>
                <div className="d-flex flex-column justify-content-center">
                    <SubscribeButton author={props.author}/>
                </div>
            </div>
            {posts && posts.map((item) => (
                <div key={item.url} className={cn('list')}>
                    <div className={cn('image')}>
                        <Link href="/[author]/[posturl]" as={`/@${item.author}/${item.url}`}>
                            <a>
                                {item.image && (
                                    <img
                                        className="lazy mt-4"
                                        src={getPostsImage(item.image, { preview: true })}
                                        data-src={getPostsImage(item.image, { minify: true })}
                                        height="400"
                                    />
                                )}
                            </a>
                        </Link>
                    </div>
                    <div>
                        <Text tag="h3" className="mt-4 mb-2" fontSize={7} fontWeight={700}>
                            <Link href="/[author]/[posturl]" as={`/@${item.author}/${item.url}`}>
                                <a className="deep-dark">
                                    {item.title}
                                </a>
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
