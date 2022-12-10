import classNames from 'classnames/bind';
import styles from './PageNavigation.module.scss';
const cn = classNames.bind(styles);

import Link from 'next/link';
import { useMemo } from 'react';

export interface PageNavigationProps {
    active: string;
    items: {
        link: string;
        name: string;
    }[];
    disableLink?: boolean;
}

export function PageNavigation(props: PageNavigationProps) {
    const active = useMemo(() => props.items.findIndex((item) => item.name === props.active), [props.active, props.items]);

    return (
        <ul className={cn('nav')}>
            <span className={cn('line', 'active-' + active)}/>
            {props.items.map((item, idx) => (
                <li
                    key={idx}
                    className={cn({ active: item.name === props.active })}>
                    {props.disableLink ? (
                        item.name
                    ) : (
                        <Link href={item.link}>
                            <a>{item.name}</a>
                        </Link>
                    )}
                </li>
            ))}
        </ul>
    );
}
