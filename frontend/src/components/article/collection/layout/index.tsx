import { PageNavigation } from '@components/integrated'

const NAVIGATION_ITEMS = [
    {
        link: '/',
        name: '인기 포스트'
    },
    {
        link: '/newest',
        name: '최신 포스트'
    },
    {
        link: '/tags',
        name: '태그 클라우드'
    },
];

export interface LayoutProps {
    active: '인기 포스트' | '최신 포스트' | '태그 클라우드';
    children: JSX.Element;
}

export function Layout(props: LayoutProps) {
    return (
        <div className="container">
            <PageNavigation
                items={NAVIGATION_ITEMS}
                active={props.active}
            />
            {props.children}
        </div>
    )
}