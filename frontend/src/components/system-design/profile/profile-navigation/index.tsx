import classNames from 'classnames/bind';
import styles from './Navigation.module.scss';
const cn = classNames.bind(styles);

import Link from 'next/link';

const TAB_ITEMS = [{
    title: '개요',
    active: 'overview',
    location: ''
}, {
    title: '포스트',
    active: 'posts',
    location: '/posts'
}, {
    title: '시리즈',
    active: 'series',
    location: '/series'
}, {
    title: '소개',
    active: 'about',
    location: '/about'
}];

export interface ProfileNavigationProps {
    username: string;
    active: string;
}

export function ProfileNavigation(props: ProfileNavigationProps) {
    return (
        <div className={`${cn('navigation')} back-image mt-5`}>
            <div className={cn('mask')}>
                <ul>
                    {TAB_ITEMS.map((item, idx) => (
                        <li
                            key={idx}
                            className={cn(
                                { active: props.active === item.active }
                            )}>
                            <Link
                                href={`/[author]${item.location}`}
                                as={`/@${props.username}${item.location}`}
                                scroll={false}>
                                <a>
                                    {item.title}
                                </a>
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}