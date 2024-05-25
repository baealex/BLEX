import classNames from 'classnames/bind';
import styles from './SettingNavigation.module.scss';
const cx = classNames.bind(styles);

import Link from 'next/link';

export interface SettingNavigationProps {
    active?: string;
}

export const NAVIGATION_ITEMS = [
    {
        title: '사용자 설정',
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
            },
            {
                title: '초대장',
                name: 'invitation',
                url: '/setting/invitation'
            }
        ]
    },
    {
        title: '서비스 설정',
        icon: 'fas fa-wrench',
        subItems: [
            {
                title: '알림',
                name: 'notify',
                url: '/setting/notify'
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
                title: '예약 포스트',
                name: 'posts/reserved',
                url: '/setting/posts/reserved'
            },
            {
                title: '임시 포스트',
                name: 'posts/draft',
                url: '/setting/posts/draft'
            },
            {
                title: '서식',
                name: 'forms',
                url: '/setting/forms'
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
    },
    {
        title: '블로그 분석',
        icon: 'fas fa-chart-line',
        subItems: [
            {
                title: '조회수',
                name: 'analytics/views',
                url: '/setting/analytics/views'
            },
            {
                title: '검색어',
                name: 'analytics/search',
                url: '/setting/analytics/search'
            },
            {
                title: '외부 링크',
                name: 'analytics/referer',
                url: '/setting/analytics/referer'
            }
        ]
    },
    {
        title: '외부 서비스 연동',
        icon: 'fas fa-link',
        subItems: [
            {
                title: '오픈 AI',
                name: 'integration/open-ai',
                url: '/setting/integration/open-ai'
            },
            {
                title: '텔레그램',
                name: 'integration/telegram',
                url: '/setting/integration/telegram'
            }
        ]
    }
] as const;

export function SettingNavigation({ active }: SettingNavigationProps) {
    return (
        <div
            className={cx('box', 'py-2')}>
            {NAVIGATION_ITEMS.map(item => (
                <div key={item.title} className={cx('section')}>
                    <div className={cx('title', 'px-3', 'py-2')}>
                        <i className={item.icon} /> {item.title}
                    </div>
                    <div className={cx('sub-item')}>
                        {item.subItems?.map(subItem => (
                            <Link key={subItem.url} href={subItem.url} scroll={false}>
                                <div
                                    key={subItem.url}
                                    className={cx(
                                        'px-3',
                                        'py-2',
                                        'mb-1',
                                        { active: active == subItem.name }
                                    )}>
                                    {subItem.title}
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
