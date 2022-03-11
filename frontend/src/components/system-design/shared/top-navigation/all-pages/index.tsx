import styles from './AllPages.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import Link from 'next/link';

export interface AllPagesProps {
    isOpen: boolean,
    onClose: (close: boolean) => void;
    username: string;
}

export function AllPages({
    isOpen,
    onClose,
    username
}: AllPagesProps) {
    return (
        <div className={cn('box', { isOpen })}>
            <div className={cn('close')} onClick={() => onClose(false)}>
                <i className="fas fa-times"/>
            </div>
            <div className="container">
                <div className={cn('header')}>포스트 조회</div>
                <ul>
                    <li>
                        <Link href="/search">
                            <a>검색</a>
                        </Link>
                    </li>
                    <li>
                        <Link href="/">
                            <a>주간 트렌드</a>
                        </Link>
                    </li>
                    <li>
                        <Link href="/">
                            <a>최신 포스트</a>
                        </Link>
                    </li>
                    <li>
                        <Link href="/popular">
                            <a>인기 포스트</a>
                        </Link>
                    </li>
                    <li>
                        <Link href="/tags">
                            <a>태그 클라우드</a>
                        </Link>
                    </li>
                    <li>내가 추천한 포스트</li>
                    <li>구독한 블로거 피드</li>
                </ul>
                <div className={cn('header')}>댓글 조회</div>
                <ul>
                    <li>내가 작성한 댓글</li>
                    <li>내가 추천한 댓글</li>
                </ul>
                <div className={cn('header')}>블로그</div>
                <ul>
                    <li>
                        <Link href={`/@${username}`}>
                            <a>내 블로그</a>
                        </Link>
                    </li>
                    <li>
                        <Link href="/write">
                            <a>새 글 작성</a>
                        </Link>
                    </li>
                    <li>
                        <Link href="/setting/posts">
                            <a>포스트 관리</a>
                        </Link>
                    </li>
                    <li>
                        <Link href="/setting/series">
                            <a>시리즈 관리</a>
                        </Link>
                    </li>
                    <li>
                        <Link href="/setting/forms">
                            <a>글 서식 관리</a>
                        </Link>
                    </li>
                    <li>
                        <Link href="/setting/analytics">
                            <a>조회수 및 유입 분석</a>
                        </Link>
                    </li>
                </ul>
                <div className={cn('header')}>계정</div>
                <ul>
                    <li>
                        <Link href="/setting/account">
                            <a>계정 정보 변경</a>
                        </Link>
                    </li>
                    <li>
                        <Link href="/setting/profile">
                            <a>프로필 정보 변경</a>
                        </Link>
                    </li>
                </ul>
            </div>
        </div>
    )
}