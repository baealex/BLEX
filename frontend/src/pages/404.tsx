import Link from 'next/link';

import { Button, Flex, Text } from '@design-system';
import { SEO } from '@system-design/shared';

export default function NotFound() {
    return (
        <>
            <SEO title="404 Not Found" />

            <div className="x-container">
                <Flex direction="column" gap={4} align="center">
                    <img className="w-100" src="/illustrators/doll-play.svg" />
                    <Text fontSize={6} fontWeight={600}>
                        페이지를 찾을 수 없습니다.
                    </Text>
                    <Flex gap={2}>
                        <Link href="/">
                            <Button>인기 포스트</Button>
                        </Link>
                        <Link href="/search">
                            <Button>컨텐츠 검색</Button>
                        </Link>
                    </Flex>
                </Flex>
            </div>
        </>
    );
}
