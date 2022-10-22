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
                <div className="row">
                    {props.posts.map((post) => (
                        <ArticleCard key={post.url} {...post}/>
                    ))}
                </div>
                {props.children}
                <style jsx>{`
                    .row {
                        margin-top: 1.5rem;
                        display: grid;
                        gap: 2rem;
                        grid-template: 1fr / repeat(3, minmax(0, 1fr));

                        @media (max-width: 960px) {
                            grid-template: 1fr / repeat(2, minmax(0, 1fr));
                        }

                        @media (max-width: 576px) {
                            grid-template: 1fr / repeat(1, minmax(0, 1fr));
                        }
                    }
                `}</style>
            </div>
            <Footer/>
        </>
    );
}
