import classNames from 'classnames/bind';
import styles from './AllPages.module.scss';
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
        <div className={cn('box', {
            isOpen 
        })}>
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
                </ul>
                <div className={cn('header')}>관리</div>
                <ul>
                    <li>
                        <Link href="/setting/account">
                            <a>사용자 관리</a>
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
                </ul>
            </div>
        </div>
    );
}