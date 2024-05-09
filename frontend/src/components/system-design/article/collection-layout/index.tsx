import { useValue } from 'badland-react';

import { Container, PageNavigationLayout, WidgetLayout } from '@design-system';

import { Footer } from '../../shared';

import { authStore } from '~/stores/auth';

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
    children?: React.ReactNode;
    widget?: React.ReactNode;
    itemExpended?: (tag: typeof NAVIGATION_ITEMS) => typeof NAVIGATION_ITEMS;
}

export function CollectionLayout(props: CollectionLayoutProps) {
    const [isLogin] = useValue(authStore, 'isLogin');

    const navItems = isLogin
        ? LOGGED_IN_NAVIGATION_ITEMS
        : NAVIGATION_ITEMS;

    return (
        <>
            <Container>
                <PageNavigationLayout
                    navigationItems={props.itemExpended?.(navItems) ?? navItems}
                    navigationActive={props.active}>
                    <WidgetLayout widget={props.widget}>
                        {props.children}
                    </WidgetLayout>
                </PageNavigationLayout>
            </Container>
            <Footer />
        </>
    );
}
