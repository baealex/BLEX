import Link from 'next/link';

import { Flex, Grid, ImageCard, LazyLoadedImage, Text } from '~/components/design-system';

import { getPostImage } from '~/modules/utility/image';

export interface SeriesProps {
    series: {
        url: string;
        name: string;
        image: string;
        owner: string;
        createdDate: string;
        totalPosts: number;
    }[];
    children?: JSX.Element;
}

export function UserSeries(props: SeriesProps) {
    return (
        <Grid
            gap={3}
            column={{
                tablet: 2,
                mobile: 1
            }}>
            {props.series.map((item) => (
                <Link className="white" href={`/@${item.owner}/series/${item.url}`}>
                    <ImageCard
                        bgHash={item.name}
                        image={(
                            <LazyLoadedImage
                                previewImage={getPostImage(item.image, {
                                    preview: true
                                })}
                                src={getPostImage(item.image, {
                                    minify: true
                                })}
                                alt={item.name}
                            />
                        )}>
                        <Flex className="w-100" direction="column" align="center" gap={1}>
                            <Text fontWeight={600}>
                                “{item.name}” 시리즈
                            </Text>
                            <Flex className="w-100" justify="center" gap={1}>
                                <Text fontSize={2}>
                                    {item.createdDate}
                                </Text>
                                <Text fontSize={2}>
                                    ·
                                </Text>
                                <Text fontSize={2}>
                                    {item.totalPosts}개의 포스트
                                </Text>
                            </Flex>
                        </Flex>
                    </ImageCard>
                </Link>
            ))}
            {props.children}
        </Grid>
    );
}
