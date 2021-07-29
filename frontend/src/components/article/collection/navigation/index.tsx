import styles from './Navigation.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import { useEffect, useState } from 'react';
import Link from 'next/link';

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

export interface NavigationProps {
    active: '인기 포스트' | '최신 포스트' | '태그 클라우드';
}

export function Navigation(props: NavigationProps) {
    const [active, setActive] = useState(NAVIGATION_ITEMS.findIndex((item) => item.name === props.active));

    useEffect(() => {
        setActive(NAVIGATION_ITEMS.findIndex((item) => item.name === props.active))
    }, [props.active])

    return (
        <>
            <ul className={cn('nav')}>
                <>
                    <span className={cn('line')}/>
                    <style jsx>{`
                        .${cn('line')} {
                            transform: translate3d(${`${active * 100}%`}, 0, 0);
                        }
                    `}</style>
                </>
                {NAVIGATION_ITEMS.map((item, idx) => (
                    <li key={idx} className={cn({
                        active: item.name === props.active
                    })}>
                        <Link href={item.link}>
                            <a>{item.name}</a>
                        </Link>
                    </li>
                ))}
            </ul>
        </>
    )
}