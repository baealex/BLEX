import classNames from 'classnames/bind';
import styles from './Pagination.module.scss';
const cn = classNames.bind(styles);

import Link from 'next/link';
import React from 'react';

import { useRouter } from 'next/router';

export interface Props {
    disableScroll?: boolean;
    hash?: string;
    page: number;
    last: number;
}

export function Pagination(props: Props) {
    const router = useRouter();

    const page = Number(props.page);
    const last = Number(props.last);

    const pageRange = [];
    for (let num = 1; num < last + 1; num++) {
        if (page == num) {
            pageRange.push(num);
        }
        else if (page == 1 && num < page + 5) {
            pageRange.push(num);
        }
        else if (page == 2 && num < page + 4) {
            pageRange.push(num);
        }
        else if (num > page - 3 && num < page + 3) {
            pageRange.push(num);
        }
        else if (page == last - 1 && num > page - 4) {
            pageRange.push(num);
        }
        else if (page == last && num > page - 5) {
            pageRange.push(num);
        }
    }

    const gotoPage = (num: number) => {
        const visibleQueries = [
            'q'
        ];

        const asQuery = visibleQueries.reduce((acc, cur) => {
            if (router.query[cur]) {
                return {
                    ...acc,
                    [cur]: router.query[cur]
                };
            }
            return acc;
        }, {});

        return {
            as: {
                pathname: router.asPath.split('?')[0],
                hash: props.hash,
                query: {
                    ...asQuery,
                    page: num
                }
            },
            href: {
                pathname: router.pathname,
                hash: props.hash,
                query: {
                    ...router.query,
                    page: num
                }
            },
            scroll: !props.disableScroll
        };
    };

    return (
        <>
            <nav className={cn('nav')}>
                <div className={cn('action', 'prev')}>
                    {page != 1 ? (
                        <>
                            <div className={cn('item')}>
                                <Link className={cn('link')} {...gotoPage(page - 1)}>
                                    <i role="button" aria-label="prev-page" className="fas fa-arrow-left"></i>
                                </Link>
                            </div>
                            <div className={cn('item')}>
                                <Link className={cn('link')} {...gotoPage(1)}>
                                    <i role="button" aria-label="first-page" className="fa fa-angle-double-left"></i>
                                </Link>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className={cn('item', 'disabled')}>
                                <a className={cn('link')}>
                                    <i role="button" aria-label="prev-page" className="fas fa-arrow-left"></i>
                                </a>
                            </div>
                            <div className={cn('item', 'disabled')}>
                                <a className={cn('link')}>
                                    <i role="button" aria-label="first-page" className="fa fa-angle-double-left"></i>
                                </a>
                            </div>
                        </>
                    )}
                </div>
                <div className={cn('pages')}>
                    {pageRange.map((item, idx) => (
                        <div
                            key={idx}
                            className={cn('item', { active: page == item })}>
                            <Link className={cn('link')} {...gotoPage(item)}>
                                {item}
                            </Link>
                        </div>
                    ))}
                </div>
                <div className={cn('action', 'next')}>
                    {page != last ? (
                        <>
                            <div className={cn('item')}>
                                <Link className={cn('link')} {...gotoPage(last)}>
                                    <i role="button" aria-label="last-page" className="fa fa-angle-double-right"></i>
                                </Link>
                            </div>
                            <div className={cn('item')}>
                                <Link className={cn('link')} {...gotoPage(page + 1)}>
                                    <i role="button" aria-label="next-page" className="fas fa-arrow-right"></i>
                                </Link>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className={cn('item', 'disabled')}>
                                <a className={cn('link')}>
                                    <i role="button" aria-label="last-page" className="fa fa-angle-double-right"></i>
                                </a>
                            </div>
                            <div className={cn('item', 'disabled')}>
                                <a className={cn('link')}>
                                    <i role="button" aria-label="next-page" className="fas fa-arrow-right"></i>
                                </a>
                            </div>
                        </>
                    )}
                </div>
            </nav>
        </>
    );
}
