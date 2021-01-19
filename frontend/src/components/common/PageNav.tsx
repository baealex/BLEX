import React, { useState } from 'react';
import Link from 'next/link';

import { useRouter } from 'next/router';

export interface Props {
    page: Number,
    last: Number
}

export default function(props: Props) {
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
            <nav className="pgnav noto" aria-label="Page navigation">
                <ul className="pg none-list">
                    {page != 1 ? (
                        <>
                            <li className="pi">
                                <Link href={{
                                    pathname: router.pathname,
                                    query: { ...router.query, page: page - 1 }
                                }}>
                                    <a className="pl">
                                        <i className="fas fa-arrow-left"></i>
                                    </a>
                                </Link>
                            </li>
                            <li className="pi">
                                <Link href={{
                                    pathname: router.pathname,
                                    query: { ...router.query, page: 1 }
                                }}>
                                    <a className="pl">
                                        <i className="fa fa-angle-double-left" aria-hidden="true"></i>
                                    </a>
                                </Link>
                            </li>
                        </>
                    ) : (
                        <>
                            <li className="pi disabled">    
                                <a className="pl">
                                    <i className="fas fa-arrow-left"></i>
                                </a>
                            </li>
                            <li className="pi disabled">
                                <a className="pl">
                                    <i className="fa fa-angle-double-left" aria-hidden="true"></i>
                                </a>
                            </li>
                        </>
                    )}
                    {pageRange.map((item, idx) => (
                        <li key={idx} className={`pi ${page == item ? 'active' : ''}`}>
                            <Link href={{
                                pathname: router.pathname,
                                query: { ...router.query, page: item }
                            }}>
                                <a className="pl">
                                    {item}
                                </a>
                            </Link>
                        </li>
                    ))}
                    {page != last ? (
                        <>
                            <li className="pi">
                                <Link href={{
                                    pathname: router.pathname,
                                    query: { ...router.query, page: last }
                                }}>
                                    <a className="pl">
                                        <i className="fa fa-angle-double-right" aria-hidden="true"></i>
                                    </a>
                                </Link>
                            </li>
                            <li className="pi">
                                <Link href={{
                                    pathname: router.pathname,
                                    query: { ...router.query, page: page + 1 }
                                }}>
                                    <a className="pl">
                                        <i className="fas fa-arrow-right"></i>
                                    </a>
                                </Link>
                            </li>
                        </>
                    ) : (
                        <>
                            <li className="pi disabled">
                                <a className="pl">
                                    <i className="fa fa-angle-double-right" aria-hidden="true"></i>
                                </a>
                            </li>
                            <li className="pi disabled">    
                                <a className="pl">
                                    <i className="fas fa-arrow-right"></i>
                                </a>
                            </li>
                        </>
                    )}
                </ul>
                <ul className="ps none-list mobile-disable">
                    <span className="vs shallow-dark mr-2">Go to page</span>
                    <input
                        className="pn"
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
                        <button className="gp">
                            Go <i className="fas fa-chevron-right"></i>
                        </button>
                    </Link>
                </ul>
            </nav>
        </>
    )
}