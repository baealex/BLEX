import Link from 'next/link';

interface Props { 
    sticky?: boolean;
    tabname?: string;
}

export default function(props: Props) {
    const stickyClass = props.sticky ? 'sticky-top-100 sticky-top' : ''

    return (
        <ul className={`nav noto ${stickyClass} blex-card`}>
            <li className="nav-item">
                <Link href="/setting">
                    <a className={`nav-link ${props.tabname == 'notify' ? 'deep' : 'shallow'}-dark`}><i className="far fa-envelope"></i> 알림</a>
                </Link>
            </li>
            <li className="nav-item">
                <Link href="/setting/account">
                    <a className={`nav-link ${props.tabname == 'account' ? 'deep' : 'shallow'}-dark`}><i className="far fa-user"></i> 계정</a>
                </Link>
            </li>
            <li className="nav-item">
                <Link href="/setting/profile">
                    <a className={`nav-link ${props.tabname == 'profile' ? 'deep' : 'shallow'}-dark`}><i className="far fa-id-badge"></i> 프로필</a>
                </Link>
            </li>
            <li className="nav-item">
                <Link href="/setting/series">
                    <a className={`nav-link ${props.tabname == 'series' ? 'deep' : 'shallow'}-dark`}><i className="fas fa-book"></i> 시리즈</a>
                </Link>
            </li>
            <li className="nav-item">
                <Link href="/setting/posts">
                    <a className={`nav-link ${props.tabname == 'posts' ? 'deep' : 'shallow'}-dark`}><i className="fas fa-pencil-alt"></i> 포스트</a>
                </Link>
            </li>
            <li className="nav-item">
                <Link href="/setting/analytics">
                    <a className={`nav-link ${props.tabname == 'analytics' ? 'deep' : 'shallow'}-dark`}><i className="fas fa-chart-line"></i> 분석</a>
                </Link>
            </li>
        </ul>
    );
}