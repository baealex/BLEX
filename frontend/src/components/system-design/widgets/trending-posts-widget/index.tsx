import Link from 'next/link';

import { Card, Flex, Loading, Text } from '~/components/design-system';

import { useFetch } from '~/hooks/use-fetch';

import * as API from '~/modules/api';

export function TrendingPostsWidget() {
    const { data: trendyPosts, isLoading } = useFetch(['trend'], async () => {
        const { data } = await API.getPopularPosts(1);
        return data.body.posts;
    });

    return (
        <Card className="p-3" hasShadow isRounded>
            <Flex direction="column" gap={3}>
                <Flex align="center" gap={2}>
                    <Text fontWeight={600} className="gray-dark">
                        <i className="fas fa-fire"></i>
                    </Text>
                    <Text fontWeight={600} className="gray-dark">
                        Trending Posts
                    </Text>
                </Flex>
                {isLoading && (
                    <Flex justify="center" className="mt-3 w-100">
                        <Loading position="inline" />
                    </Flex>
                )}
                <Flex direction="column" gap={4}>
                    {trendyPosts?.map((post) => (
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
                                    <img width={30} height={30} style={{ borderRadius: '50%' }} src={post.authorImage} />
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