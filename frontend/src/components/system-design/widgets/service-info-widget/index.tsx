import { Card, Flex, Text } from '~/components/design-system';

export function ServiceInfoWidget() {
    return (
        <Card hasShadow isRounded className="p-3">
            <Flex direction="column" gap={3}>
                <Flex align="center" gap={2}>
                    <Text fontWeight={600} className="gray-dark">
                        <i className="fas fa-info-circle" />
                    </Text>
                    <Text fontWeight={600} className="gray-dark">
                        About
                    </Text>
                </Flex>
                <Flex direction="column" gap={3}>
                    <a
                        className="deep-dark"
                        href="https://about.blex.me"
                        target="_blank"
                        rel="noreferrer">
                        <Flex align="center" gap={2}>
                            <i className="fas fa-arrow-right" />
                            <Text>서비스 소개</Text>
                        </Flex>
                    </a>
                    <a
                        className="deep-dark"
                        href="https://github.com/baealex/BLEX"
                        target="_blank"
                        rel="noreferrer">
                        <Flex align="center" gap={2}>
                            <i className="fab fa-github github" />
                            <Text>오픈소스</Text>
                        </Flex>
                    </a>
                    <a
                        className="deep-dark"
                        href="https://discord.gg/cs2XcEwSr9"
                        target="_blank"
                        rel="noreferrer">
                        <Flex align="center" gap={2}>
                            <i className="fab fa-discord discord" />
                            <Text>커뮤니티</Text>
                        </Flex>
                    </a>
                </Flex>
            </Flex>
        </Card >
    );
}