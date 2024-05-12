import Link from 'next/link';

import { ImageCard, LazyLoadedImage, Text } from '~/components/design-system';

import { getPostImage } from '~/modules/utility/image';

export interface TagCardProps {
    name: string;
    count: number;
    image?: string;
}

export function TagCard(props: TagCardProps) {
    return (
        <Link className="white" href={`/tags/${props.name}`}>
            <ImageCard
                bgHash={props.name}
                image={props.image && (
                    <LazyLoadedImage
                        alt={props.name}
                        src={getPostImage(props.image)}
                        previewImage={getPostImage(props.image, { preview: true })}
                    />
                )}>
                <Text fontSize={5} fontWeight={600}>
                    ({props.count}) {props.name}
                </Text>
            </ImageCard>
        </Link>
    );
}
