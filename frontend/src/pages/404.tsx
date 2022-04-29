import Head from 'next/head';
import Link from 'next/link';
import { useMemo } from 'react';

import { GlitchText } from '@design-system';

export default function NotFound() {
    const letters = useMemo(() => '404페이지를찾을수없습니다PAGENOTFOUND!@#$'.split(''), []);

    return (
        <>
            <Head>
                <title>404 Not Found</title>
            </Head>
            
            <div className="container h-100">
                <div className="d-flex justify-content-center align-items-center flex-wrap h-100">
                    <div className="text-center">
                        <GlitchText letters={letters}/>
                        <p>찾으시는 페이지는 삭제되어 존재하지 않습니다.</p>
                        <div>
                            <Link href="/search">
                                <button className="btn btn-dark m-1">컨텐츠 검색</button>
                            </Link>
                            <Link href="/">
                                <button className="btn btn-dark m-1">메인 홈</button>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                :global(.content) {
                    margin-top: 0 !important;
                    height: 100vh;
                }
            `}</style>
        </>
    );
}