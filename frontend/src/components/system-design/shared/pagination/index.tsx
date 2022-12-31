import classNames from 'classnames/bind';
import styles from './Pagination.module.scss';
const cn = classNames.bind(styles);

import Link from 'next/link';
import React from 'react';

import { useRouter } from 'next/router';

export interface Props {
    disableScroll?: boolean;
    page: number;
    last: number;
}

export function Pagination(props: Props) {
    const router = useRouter();

    const pageRange = [];
    const page = Number(props.page);
    const last = Number(props.last);
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
                query: {
                    ...asQuery,
                    page: num
                }
            },
            href: {
                pathname: router.pathname,
                query: {
                    ...router.query,
                    page: num
                }
            },
            scroll: !props.disableScroll
        };
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const { value } = (e.target as HTMLFormElement).page as HTMLInputElement;
        router.push(gotoPage(Number(value)).as);
    };

    return (
        <>
            <nav className={cn('nav')}>
                <div className={cn('pages')}>
                    {page != 1 ? (
                        <>
                            <div className={cn('item')}>
                                <Link {...gotoPage(page - 1)}>
                                    <a className={cn('link')}>
                                        <i role="button" aria-label="prev-page" className="fas fa-arrow-left"></i>
                                    </a>
                                </Link>
                            </div>
                            <div className={cn('item')}>
                                <Link {...gotoPage(1)}>
                                    <a className={cn('link')}>
                                        <i role="button" aria-label="first-page" className="fa fa-angle-double-left"></i>
                                    </a>
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
                    {pageRange.map((item, idx) => (
                        <div
                            key={idx}
                            className={cn('item', { active: page == item })}>
                            <Link {...gotoPage(item)}>
                                <a className={cn('link')}>
                                    {item}
                                </a>
                            </Link>
                        </div>
                    ))}
                    {page != last ? (
                        <>
                            <div className={cn('item')}>
                                <Link {...gotoPage(last)}>
                                    <a className={cn('link')}>
                                        <i role="button" aria-label="last-page" className="fa fa-angle-double-right"></i>
                                    </a>
                                </Link>
                            </div>
                            <div className={cn('item')}>
                                <Link {...gotoPage(page + 1)}>
                                    <a className={cn('link')}>
                                        <i role="button" aria-label="next-page" className="fas fa-arrow-right"></i>
                                    </a>
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
                <form className={`${cn('search')}`} onSubmit={handleSubmit}>
                    <label className="d-flex align-items-center">
                        <span className="vs shallow-dark">
                            Go to page
                        </span>
                        <input
                            name="page"
                            className={cn('num', 'ml-2')}
                            type="number"
                            min={1}
                            max={last}
                            defaultValue={page}
                        />
                    </label>
                    <button type="submit" aria-label="go-page" className={`${cn('go')} shallow-dark`}>
                        Go <i className="fas fa-chevron-right"></i>
                    </button>
                </form>
            </nav>
        </>
    );
}
