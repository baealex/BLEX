import Link from 'next/link';

import { Button, Container, Flex, Text } from '~/components/design-system';
import { SEO } from '~/components/system-design/shared';

export default function NotFound() {
    return (
        <>
            <SEO title="페이지를 찾을 수 없습니다." />

            <Container size="sm">
                <Flex direction="column" gap={4} align="center">
                    <img className="w-100" src="/illustrators/doll-play.svg" />
                    <Text fontSize={6} fontWeight={600}>
                        해당 페이지는 삭제되었거나, 수정되었습니다.
                    </Text>
                    <Flex gap={2}>
                        <Link href="/">
                            <Button>최신 포스트</Button>
                        </Link>
                        <Link href="/search">
                            <Button>포스트 검색</Button>
                        </Link>
                    </Flex>
                </Flex>
            </Container>
        </>
    );
}
