import styles from './PageNavigation.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import { useEffect, useState } from 'react';
import Link from 'next/link';

export interface PageNavigationProps {
    active: string;
    items: {
        link?: string;
        name: string;
    }[];
    disableLink?: boolean;
}

export function PageNavigation(props: PageNavigationProps) {
    const [active, setActive] = useState(props.items.findIndex((item) => item.name === props.active));

    useEffect(() => {
        setActive(props.items.findIndex((item) => item.name === props.active))
    }, [props.active])

    return (
        <>
            <ul className={cn('nav')}>
                <span className={cn('line', 'active-' + active)}/>
                {props.items.map((item, idx) => (
                    <li key={idx} className={cn({
                        active: item.name === props.active
                    })}>
                        {props.disableLink ? (
                            <>{item.name}</>
                        ) : (
                            <Link href={item.link!}>
                                <a>{item.name}</a>
                            </Link>
                        )}
                    </li>
                ))}
            </ul>
        </>
    )
}