import { useEffect, useState } from 'react';
import { useValue } from 'badland-react';

import { Container, Flex, Loading, PageNavigationLayout, WidgetLayout } from '@design-system';
import { ArticleCard } from '../article-card';
import { Footer } from '@system-design/shared';

import * as API from '~/modules/api';
import { lazyLoadResource } from '~/modules/optimize/lazy';
import { snackBar } from '~/modules/ui/snack-bar';

import { authStore } from '~/stores/auth';
import { modalStore } from '~/stores/modal';

import { useInfinityScroll } from '~/hooks/use-infinity-scroll';
import { useMemoryStore } from '~/hooks/use-memory-store';

const NAVIGATION_ITEMS = [
    {
        link: '/',
        name: 'Home'
    },
    {
        link: '/tags',
        name: 'Tags'
    }
];

const LOGGED_IN_NAVIGATION_ITEMS = [
    ...NAVIGATION_ITEMS.slice(0, 1),
    {
        link: '/favorite',
        name: 'Favorite'
    },
    ...NAVIGATION_ITEMS.slice(1)
];

export interface CollectionLayoutProps {
    active: 'Home' | 'Favorite' | 'Tags';
    posts: API.GetPostsResponseData['posts'];
    lastPage: number;
    children?: React.ReactNode;
    widget?: React.ReactNode;
    itemExpended?: (tag: typeof NAVIGATION_ITEMS) => typeof NAVIGATION_ITEMS;
}

export function CollectionLayout(props: CollectionLayoutProps) {
    const [isLogin] = useValue(authStore, 'isLogin');

    const navItems = isLogin
        ? LOGGED_IN_NAVIGATION_ITEMS
        : NAVIGATION_ITEMS;

    const memoryStore = useMemoryStore(['article', props.active], {
        page: 1,
        posts: props.posts
    });

    const [page, setPage] = useState(memoryStore.page);
    const [posts, setPosts] = useState(memoryStore.posts);

    const { isLoading } = useInfinityScroll(async () => {
        const { data } = props.active === 'Home'
            ? await API.getNewestPosts(page + 1)
            : await API.getLikedPosts(page + 1);

        if (data.status === 'DONE') {
            setPage((prevPage) => {
                memoryStore.page = prevPage + 1;
                return memoryStore.page;
            });
            setPosts((prevPosts) => {
                memoryStore.posts = [...prevPosts, ...data.body.posts];
                return memoryStore.posts;
            });
        }
    }, { enabled: memoryStore.page < props.lastPage && props.active !== 'Tags' });

    const handleLike = async (post: API.GetPostsResponseData['posts'][number]) => {
        const { data } = await API.putAnUserPosts('@' + post.author, post.url, 'like');
        if (data.status === 'DONE') {
            if (typeof data.body.countLikes === 'number') {
                setPosts((prevState) => prevState.map((_post) => {
                    if (_post.url === post.url) {
                        _post.hasLiked = !_post.hasLiked;
                        _post.countLikes = data.body.countLikes as number;
                    }
                    return _post;
                }));
            }
        }
        if (data.status === 'ERROR') {
            if (data.errorCode === API.ERROR.NEED_LOGIN) {
                snackBar('😅 로그인이 필요합니다.', {
                    onClick: () => {
                        modalStore.open('isOpenAuthGetModal');
                    }
                });
            }
        }
    };

    useEffect(lazyLoadResource, [posts]);

    useEffect(() => {
        setPage(memoryStore.page);
        setPosts(memoryStore.posts);
    }, [memoryStore]);

    return (
        <Container>
            <PageNavigationLayout
                navigationItems={props.itemExpended?.(navItems) ?? navItems}
                navigationActive={props.active}>
                <WidgetLayout widget={props.widget}>
                    {isLoading && (
                        <Flex justify="center" className="p-3">
                            <Loading position="inline" />
                        </Flex>
                    )}
                    {posts.map((post) => (
                        <ArticleCard
                            className="mb-4"
                            hasShadow={false}
                            isRounded={false}
                            key={post.url}
                            onLike={() => handleLike(post)}
                            {...post}
                        />
                    ))}
                    {props.children}
                </WidgetLayout>
            </PageNavigationLayout>
            <Footer />
        </Container>
    );
}
