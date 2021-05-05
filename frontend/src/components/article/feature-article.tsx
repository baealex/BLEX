import { useEffect, useState } from 'react';
import Link from 'next/link';

import ArticleCard from '@components/article/ArticleCard';

import * as API from '@modules/api';
import {
    lazyIntersection
} from '@modules/lazy';

export interface FeatureArticleProps {
    author: string;
    url: string;
    realname: string;
}

export function FeatureArticle(props: FeatureArticleProps) {
    const [ posts, setPosts ] = useState<API.GetFeaturePostsDataPosts[]>([]);

    useEffect(() => {
        const observer = lazyIntersection('.page-footer', async () => {
            const { author, url } = props;
            const { data } = await API.getFeaturePosts('@'+ author, url);
            setPosts(data.body.posts);
        });

        return () => observer?.disconnect();
    }, [props.url]);

    return (
        <div className="container pt-5 reverse-color">
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