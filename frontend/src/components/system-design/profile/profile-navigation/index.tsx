import classNames from 'classnames/bind';
import styles from './Navigation.module.scss';
const cx = classNames.bind(styles);

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
        <div id="profile" className={`${cx('navigation')} back-image mt-5`}>
            <div className={cx('mask')}>
                <ul>
                    {TAB_ITEMS.map((item, idx) => (
                        <li
                            key={idx}
                            className={cx(
                                { active: props.active === item.active }
                            )}>
                            <Link
                                href={`/@${props.username}${item.location}`}
                                scroll={false}>
                                {item.title}
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
