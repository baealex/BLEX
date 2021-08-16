import { PageNavigation } from '@components/integrated'

const NAVIGATION_ITEMS = [
    {
        link: '/',
        name: '최신 포스트'
    },
    {
        link: '/tags',
        name: '태그 클라우드'
    },
];

export interface LayoutProps {
    active: '최신 포스트' | '태그 클라우드' | string;
    children: JSX.Element;
    itemExpended?: (tag: typeof NAVIGATION_ITEMS) => typeof NAVIGATION_ITEMS;
}

export function Layout(props: LayoutProps) {
    return (
        <div className="container">
            <PageNavigation
                items={props.itemExpended 
                    ? props.itemExpended(NAVIGATION_ITEMS)
                    : NAVIGATION_ITEMS}
                active={props.active}
            />
            {props.children}
        </div>
    )
}