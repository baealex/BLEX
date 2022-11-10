import { Footer } from '@system-design/shared';
import { PageNavigation } from '@design-system';

import * as API from '~/modules/api';
import { ArticleCard } from '../article-card';

const NAVIGATION_ITEMS = [
    {
        link: '/',
        name: '인기 포스트'
    },
    {
        link: '/newest',
        name: '최신 포스트'
    }
];

export interface CollectionLayoutProps {
    active: '인기 포스트' | '최신 포스트' | string;
    posts: API.GetPostsResponseData['posts'];
    children: React.ReactNode;
    itemExpended?: (tag: typeof NAVIGATION_ITEMS) => typeof NAVIGATION_ITEMS;
}

export function CollectionLayout(props: CollectionLayoutProps) {
    return (
        <>
            <div className="container">
                <PageNavigation
                    items={props.itemExpended
                        ? props.itemExpended(NAVIGATION_ITEMS)
                        : NAVIGATION_ITEMS}
                    active={props.active}
                />
                <div className="grid-321">
                    {props.posts.map((post) => (
                        <ArticleCard key={post.url} {...post}/>
                    ))}
                </div>
                {props.children}
            </div>
            <Footer/>
        </>
    );
}
