import Link from 'next/link';
import { useMemo } from 'react';

import { Button, GlitchText } from '@design-system';
import { SEO } from '@system-design/shared';

export default function NotFound() {
    const letters = useMemo(() => '404페이지를찾을수없습니다PAGENOTFOUND!@#$'.split(''), []);

    return (
        <>
            <SEO title="404 Not Found"/>

            <div className="container h-100">
                <div className="d-flex justify-content-center align-items-center flex-wrap h-100">
                    <div className="text-center">
                        <GlitchText letters={letters}/>
                        <p>찾으시는 페이지는 삭제되어 존재하지 않습니다.</p>
                        <div className="mt-3">
                            <Link href="/search">
                                <Button gap="little">컨텐츠 검색</Button>
                            </Link>
                            <Link href="/">
                                <Button>메인 홈</Button>
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
