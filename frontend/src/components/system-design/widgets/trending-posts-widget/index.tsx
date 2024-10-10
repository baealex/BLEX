import Link from 'next/link';

import { Card, Flex, Text } from '~/components/design-system';

import { useFetch } from '~/hooks/use-fetch';

import * as API from '~/modules/api';

export function TrendingPostsWidget() {
    const { data: trendyPosts } = useFetch(['trend'], async () => {
        const { data } = await API.getTrendingPosts();
        return data.body;
    });

    return (
        <Card className="p-3" hasShadow isRounded>
            <Flex direction="column" gap={3}>
                <Flex align="center" gap={2}>
                    <Text fontWeight={600} className="gray-dark">
                        <i className="fas fa-fire fire" />
                    </Text>
                    <Text fontWeight={600} className="gray-dark">
                        Trending
                    </Text>
                </Flex>
                <Flex
                    className="w-100"
                    style={{ minHeight: '391px' }}
                    direction="column"
                    gap={4}>
                    {trendyPosts?.length && trendyPosts?.map((post) => (
                        <Flex key={post.url} direction="column" gap={2}>
                            <Flex justify="between">
                                <Link className="deep-dark" href={`/@${post.author}/${post.url}`}>
                                    <Text fontWeight={600} fontSize={3}>
                                        {post.title}
                                    </Text>
                                </Link>
                            </Flex>
                            <Link href={`/@${post.author}`} className="shallow-dark">
                                <Flex gap={2} align="center">
                                    <img
                                        width={30}
                                        height={30}
                                        style={{
                                            borderRadius: '50%',
                                            objectFit: 'cover'
                                        }}
                                        src={post.authorImage}
                                    />
                                    <Text fontSize={3}>@{post.author}</Text>
                                </Flex>
                            </Link>
                        </Flex>
                    ))}
                </Flex>
            </Flex>
        </Card>
    );
}
