import { useValue } from 'badland-react';

import { Footer } from '@system-design/shared';
import { PageNavigation } from '@design-system';

import * as API from '~/modules/api';
import { ArticleCard } from '../article-card';

import { authStore } from '~/stores/auth';

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

const LOGGED_IN_NAVIGATION_ITEMS = [
    ...NAVIGATION_ITEMS,
    {
        link: '/liked',
        name: '관심 포스트'
    }
];

export interface CollectionLayoutProps {
    active: '인기 포스트' | '최신 포스트' | string;
    posts: API.GetPostsResponseData['posts'];
    children: React.ReactNode;
    itemExpended?: (tag: typeof NAVIGATION_ITEMS) => typeof NAVIGATION_ITEMS;
}

export function CollectionLayout(props: CollectionLayoutProps) {
    const [isLogin] = useValue(authStore, 'isLogin');

    const navItems = isLogin
        ? LOGGED_IN_NAVIGATION_ITEMS
        : NAVIGATION_ITEMS;

    return (
        <>
            <div className="container">
                <PageNavigation
                    items={props.itemExpended?.(navItems) ?? navItems}
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
