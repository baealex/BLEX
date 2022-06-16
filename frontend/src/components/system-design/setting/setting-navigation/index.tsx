import classNames from 'classnames/bind';
import styles from './SettingNavigation.module.scss';
const cn = classNames.bind(styles);

import Link from 'next/link';

export interface SettingNavigationProps {
    sticky?: boolean;
    active?: string;
}

const NAVIGATION_ITEMS = [
    {
        title: '사용자 관리',
        icon: 'far fa-user',
        subItems: [
            {
                title: '계정',
                name: 'account',
                url: '/setting/account'
            },
            {
                title: '프로필',
                name: 'profile',
                url: '/setting/profile'
            }
        ]
    },
    {
        title: '포스트 관리',
        icon: 'fas fa-pencil-alt',
        subItems: [
            {
                title: '포스트',
                name: 'posts',
                url: '/setting/posts'
            },
            {
                title: '서식',
                name: 'forms',
                url: '/setting/forms'
            },
            {
                title: '분석',
                name: 'analytics',
                url: '/setting/analytics'
            }
        ]
    },
    {
        title: '시리즈 관리',
        icon: 'fas fa-book',
        subItems: [
            {
                title: '시리즈',
                name: 'series',
                url: '/setting/series'
            }
        ]
    }
];

export function SettingNavigation(props: SettingNavigationProps) {
    const { sticky } = props;

    return (
        <div
            className={cn('box', 'py-2', { sticky })}>
            {NAVIGATION_ITEMS.map(item => (
                <div key={item.title} className={cn('section')}>
                    <div className={cn('title', 'px-3', 'py-2')}>
                        <i className={item.icon}/> {item.title}
                    </div>
                    <div className={cn('sub-item')}>
                        {item.subItems?.map(subItem => (
                            <Link key={subItem.url} href={subItem.url} scroll={false}>
                                <a>
                                    <div
                                        key={subItem.url}
                                        className={cn(
                                            'px-3',
                                            'py-2',
                                            { active: props.active == subItem.name }
                                        )}>
                                        {subItem.title}
                                    </div>
                                </a>
                            </Link>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}