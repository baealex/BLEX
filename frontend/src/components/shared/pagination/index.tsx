import styles from './Pagination.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import React, { useState } from 'react';
import Link from 'next/link';

import { useRouter } from 'next/router';

export interface Props {
    page: Number,
    last: Number
}

export function Pagination(props: Props) {
    const router = useRouter();
    
    const pageRange = [];
    const page = Number(props.page);
    const last = Number(props.last);
    for(let num = 1; num < last + 1; num++) {
        if(page == num) {
            pageRange.push(num);
        }
        else if(page == 1 && num < page + 5) {
            pageRange.push(num);
        }
        else if(page == 2 && num < page + 4) {
            pageRange.push(num);
        }
        else if(num > page - 3 && num < page + 3) {
            pageRange.push(num);
        }
        else if(page == last - 1 && num > page - 4) {
            pageRange.push(num);
        }
        else if(page == last && num > page - 5) {
            pageRange.push(num);
        }
    }

    const [ inputPage, setInputPage ] = useState('');

    const getPageRange = (num: number) => {
        if(num < 1)    return 1;
        if(num > last) return last;
        return num;
    };

    return (
        <>
            <nav className={`${cn('nav')} noto`}>
                <div className={cn('pages')}>
                    {page != 1 ? (
                        <>
                            <div className={cn('item')}>
                                <Link href={{
                                    pathname: router.pathname,
                                    query: {
                                        ...router.query,
                                        page: page - 1
                                    }
                                }}>
                                    <a className={cn('link')}>
                                        <i className="fas fa-arrow-left"></i>
                                    </a>
                                </Link>
                            </div>
                            <div className={cn('item')}>
                                <Link href={{
                                    pathname: router.pathname,
                                    query: { ...router.query, page: 1 }
                                }}>
                                    <a className={cn('link')}>
                                        <i className="fa fa-angle-double-left"></i>
                                    </a>
                                </Link>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className={cn('item', 'disabled')}>
                                <a className={cn('link')}>
                                    <i className="fas fa-arrow-left"></i>
                                </a>
                            </div>
                            <div className={cn('item', 'disabled')}>
                                <a className={cn('link')}>
                                    <i className="fa fa-angle-double-left"></i>
                                </a>
                            </div>
                        </>
                    )}
                    {pageRange.map((item, idx) => (
                        <div key={idx} className={cn('item', { active: page == item})}>
                            <Link href={{
                                pathname: router.pathname,
                                query: { ...router.query, page: item }
                            }}>
                                <a className={cn('link')}>
                                    {item}
                                </a>
                            </Link>
                        </div>
                    ))}
                    {page != last ? (
                        <>
                            <div className={cn('item')}>
                                <Link href={{
                                    pathname: router.pathname,
                                    query: { ...router.query, page: last }
                                }}>
                                    <a className={cn('link')}>
                                        <i className="fa fa-angle-double-right"></i>
                                    </a>
                                </Link>
                            </div>
                            <div className={cn('item')}>
                                <Link href={{
                                    pathname: router.pathname,
                                    query: { ...router.query, page: page + 1 }
                                }}>
                                    <a className={cn('link')}>
                                        <i className="fas fa-arrow-right"></i>
                                    </a>
                                </Link>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className={cn('item', 'disabled')}>
                                <a className={cn('link')}>
                                    <i className="fa fa-angle-double-right"></i>
                                </a>
                            </div>
                            <div className={cn('item', 'disabled')}>    
                                <a className={cn('link')}>
                                    <i className="fas fa-arrow-right"></i>
                                </a>
                            </div>
                        </>
                    )}
                </div>
                <div className={`${cn('search')}`}>
                    <span className="vs shallow-dark mr-2">
                        Go to page
                    </span>
                    <input
                        className={cn('num')}
                        type="number"
                        min={1}
                        max={last}
                        value={inputPage}
                        onChange={(e) => setInputPage(getPageRange(parseInt(e.target.value)).toString())}
                    />
                    <Link href={{
                        pathname: router.pathname,
                        query: { ...router.query, page: inputPage === '' ? page : inputPage }
                    }}>
                        <button className={`${cn('go')} shallow-dark`}>
                            Go <i className="fas fa-chevron-right"></i>
                        </button>
                    </Link>
                </div>
            </nav>
        </>
    )
}