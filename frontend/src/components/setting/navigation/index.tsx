import { Card } from '@design-system';
import Link from 'next/link';

export interface NavigationProps { 
    sticky?: boolean;
    tabname?: string;
}

const NAVIGATION_ITEMS = [
    {
        title: '계정',
        icon: 'far fa-user',
        name: 'account',
        url: '/setting/account',
    },
    {
        title: '프로필',
        icon: 'far fa-id-badge',
        name: 'profile',
        url: '/setting/profile',
    },
    {
        title: '포스트',
        icon: 'fas fa-pencil-alt',
        name: 'posts',
        url: '/setting/posts',
    },
    {
        title: '시리즈',
        icon: 'fas fa-book',
        name: 'series',
        url: '/setting/series',
    },
    {
        title: '서식',
        icon: 'fab fa-wpforms',
        name: 'forms',
        url: '/setting/forms',
    },
    {
        title: '분석',
        icon: 'fas fa-chart-line',
        name: 'analytics',
        url: '/setting/analytics',
    },
];

export function Navigation(props: NavigationProps) {
    const stickyClass = props.sticky ? 'sticky-top-100 sticky-top' : ''

    return (
        <Card hasShadow isRounded className="mb-3">
            <ul className={`nav ${stickyClass} d-block`}>
                {NAVIGATION_ITEMS.map((item, idx) => (
                    <li key={idx} className="nav-item">
                        <Link href={item.url}>
                            <a className={`nav-link ${
                                props.tabname == item.name
                                    ? 'deep'
                                    : 'shallow'}-dark`}>
                                <i className={item.icon}/> {item.title}
                            </a>
                        </Link>
                    </li>
                ))}
            </ul>
        </Card>
    );
}