import classNames from 'classnames/bind';
import styles from './PageNavigation.module.scss';
const cx = classNames.bind(styles);

import Link from 'next/link';
import { useMemo } from 'react';

import { clearMemoryStore } from '~/hooks/use-memory-store';

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
        <ul className={cx('nav')}>
            <span className={cx('line', 'active-' + active)}/>
            {props.items.map((item, idx) => (
                <li
                    key={idx}
                    className={cx({ active: item.name === props.active })}>
                    {props.disableLink ? (
                        item.name
                    ) : (
                        <Link href={item.link} onClick={() => clearMemoryStore()}>
                            {item.name}
                        </Link>
                    )}
                </li>
            ))}
        </ul>
    );
}
