import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { useValue } from 'badland-react';

import { SEO } from '@system-design/shared';
import { Text } from '@design-system';

import { authStore } from '@stores/auth';

export const getServerSideProps: GetServerSideProps = async () => {
    return { props: {} };
};

export default function Map() {
    const [ isLogin ] = useValue(authStore, 'isLogin');

    return (
        <>
            <SEO title="전체 페이지"/>
            <div className="container">
                <div className="row">
                    <div className="col-lg-4 mb-4">
                        <Text fontSize={5} fontWeight={600}>
                            포스트 조회
                        </Text>
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
                            {isLogin && (
                                <>
                                    <li>내가 추천한 포스트</li>
                                    <li>구독한 블로거 피드</li>
                                </>
                            )}
                        </ul>
                    </div>
                    {isLogin && (
                        <div className="col-lg-4 mb-4">
                            <Text fontSize={5} fontWeight={600}>
                                댓글 조회
                            </Text>
                            <ul>
                                <li>내가 작성한 댓글</li>
                                <li>내가 추천한 댓글</li>
                            </ul>
                        </div>
                    )}
                    {isLogin && (
                        <div className="col-lg-4 mb-4">
                            <Text fontSize={5} fontWeight={600}>
                                블로그
                            </Text>
                            <ul>
                                <li>
                                    <Link href={`/@${authStore.state.username}`}>
                                        <a>내 블로그</a>
                                    </Link>
                                </li>
                                <li>
                                    <Link href="/write">
                                        <a>새 글 작성</a>
                                    </Link>
                                </li>
                            </ul>
                        </div>
                    )}
                    {isLogin && (
                        <div className="col-lg-4 mb-4">
                            <Text fontSize={5} fontWeight={600}>
                                관리
                            </Text>
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
                    )}
                </div>
                <style jsx>{`
                ul {
                    padding-left: 16px;
                    margin-top: 8px;
            
                    li {
                        font-size: 18px;
                        line-height: 2.2;
                        color: #ddd;
            
                        a {
                            text-decoration: none;
                            color: #555;
                        }
            
                        :global(body.dark) & {
                            color: #333;
            
                            a {
                                color: #eaeaea;
                            }
                        }
                    }
                }
            `}</style>
            </div>
        </>
    );
}
