import styles from './CapsuleArticleCard.module.scss';

import Link from 'next/link';

import { CapsuleCard, Flex, LazyLoadedImage, Text } from '~/components/design-system';

import { getDefaultPostCoverImage, getPostImage } from '~/modules/utility/image';

export interface CapsuleArticleCardProps {
    author: string;
    url: string;
    title: string;
    image: string;
    createdDate: string;
    readTime: number;
}

export function CapsuleArticleCard(props: CapsuleArticleCardProps) {
    return (
        <CapsuleCard
            hasShadow
            isRounded
            image={
                <Link className="deep-dark" href={`/@${props.author}/${props.url}`}>
                    <LazyLoadedImage
                        alt={props.title}
                        src={props.image
                            ? getPostImage(props.image, {
                                minify: true
                            })
                            : getDefaultPostCoverImage(props.title)}
                        previewImage={props.image
                            ? getPostImage(props.image, {
                                preview: true
                            })
                            : getDefaultPostCoverImage(props.title)}
                    />
                </Link>
            }>
            <Link className="deep-dark" href={`/@${props.author}/${props.url}`}>
                <div className={styles.title}>
                    {props.title}
                </div>
                <Flex align="center" gap={1}>
                    <Text fontSize={2} className="shallow-dark">
                        {props.createdDate}
                    </Text>
                    <Text fontSize={2} className="shallow-dark">
                        ·
                    </Text>
                    <Text fontSize={2} className="shallow-dark">
                        {props.readTime}분 분량
                    </Text>
                </Flex>
            </Link>
        </CapsuleCard>
    );
}
