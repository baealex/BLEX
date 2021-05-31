import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

import { ArticleCard } from '@components/article';

import * as API from '@modules/api';
import {
    lazyLoadResource,
    lazyIntersection
} from '@modules/lazy';

export interface FeatureArticlesProps {
    author: string;
    url: string;
    realname: string;
}

export function FeatureArticles(props: FeatureArticlesProps) {
    const element = useRef<HTMLDivElement>(null);
    const [ posts, setPosts ] = useState<API.GetFeaturePostsDataPosts[]>([]);

    useEffect(() => {
        const observer = lazyIntersection('.feature-articles', async () => {
            const { author, url } = props;
            const { data } = await API.getFeaturePosts('@'+ author, url);
            setPosts(data.body.posts);
            lazyLoadResource();
        });

        return () => observer?.disconnect();
    }, [props.url]);

    return (
        <div ref={element} className="feature-articles container pt-5 reverse-color">
            <p className="noto">
                <Link href={`/@${props.author}`}>
                    <a className="font-weight-bold deep-dark">
                        {props.realname}
                    </a>
                </Link>님이 작성한 다른 글</p>
            <div className="row">
                {posts.map((item, idx) => (
                    <ArticleCard key={idx} {...item}/>
                ))}
            </div>
        </div>
    )
}