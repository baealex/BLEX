import styles from './Pagination.module.scss';
import classNames from 'classnames/bind';

const cn = classNames.bind(styles);

import Link from 'next/link';

import { useRouter } from 'next/router';

export interface Props {
    page: Number,
    last: Number,
    hasBorder?: boolean,
}

export function Pagination(props: Props) {
    const {
        hasBorder = false,
    } = props;

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

    return (
        <>
            <nav className={'none-drag ' + cn('nav', { hasBorder })}>
                <div>
                    {page != 1 ? (
                        <Link href={{
                            query: { ...router.query, page: page - 1 }
                        }}>
                            <a className={cn('arrowBox')}>
                                <i className="fas fa-arrow-left"/>
                                <div className={cn('arrowText')}>
                                    prev
                                </div>
                            </a>
                        </Link>
                    ) : (
                        <a className={cn('arrowBox', 'disable')}>
                            <i className="fas fa-arrow-left"/>
                            <div className={cn('arrowText')}>
                                prev
                            </div>
                        </a>
                    )}
                </div>
                <div className={cn('center')}>
                    <ul className={`none-list ${cn('pages')}`}>
                        {pageRange.map((item, idx) => (
                            <li key={idx} className={page == item ? cn('active') : undefined}>
                                <Link href={{
                                    query: { ...router.query, page: item }
                                }}>
                                    <a className="pl">
                                        {item}
                                    </a>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className={cn('end')}>
                    {page != last ? (
                        <Link href={{
                            pathname: router.pathname,
                            query: { ...router.query, page: page + 1 }
                        }}>
                            <a className={cn('arrowBox')}>
                                <div className={cn('arrowText')}>
                                    next
                                </div>
                                <i className="fas fa-arrow-right"/>
                            </a>
                        </Link>
                    ) : (
                        <a className={cn('arrowBox', 'disable')}>
                            <div className={cn('arrowText')}>
                                next
                            </div>
                            <i className="fas fa-arrow-right"/>
                        </a>
                    )}
                </div>
            </nav>
        </>
    )
}