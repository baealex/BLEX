import Link from 'next/link';
import { useRef } from 'react';

import { ArticleCard } from '../../article/article-card';

import * as API from '~/modules/api';
import { useFetch } from '~/hooks/use-fetch';

export interface RelatedProps {
    author: string;
    url: string;
    name: string;
}

export function RelatedArticles(props: RelatedProps) {
    const ref = useRef<HTMLDivElement>(null);

    const { data: posts } = useFetch([
        'posts/related',
        props.author,
        props.url
    ], async () => {
        const { data } = await API.getFeaturePosts('@' + props.author, props.url);
        return data.body.posts;
    }, { observeElement: ref.current });

    return (
        <div ref={ref} className="container pt-5 reverse-color">
            <p>
                <Link href={`/@${props.author}`}>
                    <a className="font-weight-bold deep-dark">
                        {props.name}
                    </a>
                </Link>
                님이 작성한 다른 글
            </p>
            <div className="row">
                {posts && posts.map((item, idx) => (
                    <ArticleCard key={idx} className="col-lg-4 col-md-6 mt-4" {...item} />
                ))}
            </div>
        </div>
    );
}
