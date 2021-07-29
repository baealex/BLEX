import { Navigation } from '../navigation';

export interface LayoutProps {
    active: '인기 포스트' | '최신 포스트' | '태그 클라우드';
    children: JSX.Element;
}

export function Layout(props: LayoutProps) {
    return (
        <div className="container">
            <Navigation active={props.active}/>
            {props.children}
        </div>
    )
}