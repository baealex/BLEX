import React from 'react';
import Link from 'next/link';

class PageNav extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            page: props.page
        }
    }

    setPage(page) {
        this.props.setPage(page)
    }

    render() {
        const pageRange = [];
        const page = this.props.page;
        const last = this.props.last;
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
                <nav className="pgnav noto" aria-label="Page navigation">
                    <ul className="pg none-list">
                        {page != 1 ? (
                            <>
                                <li className="pi">
                                    <Link href={{ pathname: '', query: { page: page - 1 } }}>
                                        <a className="pl" onClick={() => this.setPage(page - 1)}>
                                            <i className="fas fa-arrow-left"></i>
                                        </a>
                                    </Link>
                                </li>
                                <li className="pi">
                                    <Link href={{ pathname: '', query: { page: 1 } }}>
                                        <a className="pl" onClick={() => this.setPage(1)}>
                                            <i className="fa fa-angle-double-left" aria-hidden="true"></i>
                                        </a>
                                    </Link>
                                </li>
                            </>
                        ) : (
                            <>
                                <li className="pi disabled">    
                                    <a className="pl" href="#" tabindex="-1">
                                        <i className="fas fa-arrow-left"></i>
                                    </a>
                                </li>
                                <li className="pi disabled">
                                    <a className="pl" href="#" tabindex="-1">
                                        <i className="fa fa-angle-double-left" aria-hidden="true"></i>
                                    </a>
                                </li>
                            </>
                        )}
                        {pageRange.map((item, idx) => (
                            <li className={`pi ${page == item ? 'active' : ''}`} key={idx}>
                                <Link href={{ pathname: '', query: { page: item } }}>
                                    <a className="pl" onClick={() => this.setPage(item)}>
                                        {item}
                                    </a>
                                </Link>
                            </li>
                        ))}
                        {page != last ? (
                            <>
                                <li className="pi">
                                    <Link href={{ pathname: '', query: { page: last } }}>
                                        <a className="pl" onClick={() => this.setPage(last)}>
                                            <i className="fa fa-angle-double-right" aria-hidden="true"></i>
                                        </a>
                                    </Link>
                                </li>
                                <li className="pi">
                                    <Link href={{ pathname: '', query: { page: page + 1 } }}>
                                        <a className="pl" onClick={() => this.setPage(page + 1)}>
                                            <i className="fas fa-arrow-right"></i>
                                        </a>
                                    </Link>
                                </li>
                            </>
                        ) : (
                            <>
                                <li className="pi disabled">
                                    <a className="pl" href="#" tabindex="-1">
                                        <i className="fa fa-angle-double-right" aria-hidden="true"></i>
                                    </a>
                                </li>
                                <li className="pi disabled">    
                                    <a className="pl" href="#" tabindex="-1">
                                        <i className="fas fa-arrow-right"></i>
                                    </a>
                                </li>
                            </>
                        )}
                    </ul>
                </nav>
            </>
        )
    }
}

export default PageNav;