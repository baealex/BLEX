import {
    useEffect,
    useRef,
    useState
} from 'react';
import Link from 'next/link';

import { ArticleCard } from '../../article/article-card';

import * as API from '@modules/api';
import {
    lazyIntersection,
    lazyLoadResource
} from '@modules/optimize/lazy';

export interface RelatedProps {
    author: string;
    url: string;
    realname: string;
}

export function RelatedArticles(props: RelatedProps) {
    const element = useRef<HTMLDivElement>(null);
    const [ posts, setPosts ] = useState<API.GetFeaturePostsResponseData['posts']>([]);

    useEffect(() => {
        const observer = lazyIntersection('.feature-articles', async () => {
            const {
                author,
                url
            } = props;
            const { data } = await API.getFeaturePosts('@'+ author, url);
            setPosts(data.body.posts);
            lazyLoadResource();
        });

        return () => observer?.disconnect();
    }, [props.url]);

    return (
        <div ref={element} className="feature-articles container pt-5 reverse-color">
            <p>
                <Link href={`/@${props.author}`}>
                    <a className="font-weight-bold deep-dark">
                        {props.realname}
                    </a>
                </Link>
                님이 작성한 다른 글
            </p>
            <div className="row">
                {posts.map((item, idx) => (
                    <ArticleCard key={idx} className="col-lg-4 col-md-6 mt-4" {...item} />
                ))}
            </div>
        </div>
    );
}