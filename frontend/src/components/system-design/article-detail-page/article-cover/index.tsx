import classNames from 'classnames/bind';
import styles from './ArticleCover.module.scss';
const cx = classNames.bind(styles);

import { useRouter } from 'next/router';
import Link from 'next/link';

import { getPostImage } from '~/modules/utility/image';

import { useStore } from 'badland-react';
import { configStore } from '~/stores/config';

import { LazyLoadedImage } from '~/components/design-system';
import { Badge, Container, Text } from '~/components/design-system';

export function ArticleCover(props: {
    author: string;
    image?: string;
    series?: {
        url: string;
        name: string;
    };
    title: string;
    isAd: boolean;
    createdDate: string;
}) {
    const router = useRouter();
    const [{ theme }] = useStore(configStore);
    const isDarkMode = theme === 'dark';

    const handleClickSeries = () => {
        if (props.series) {
            router.push(`/@${props.author}/series/${props.series.url}`);
        }
    };

    return (
        <header className={cx('cover', { 'dark-mode': isDarkMode })}>
            {props.image ? (
                <div className={cx('image-cover')}>
                    <LazyLoadedImage
                        previewImage={getPostImage(props.image, { minify: true })}
                        src={getPostImage(props.image)}
                        alt={props.title}
                        className={cx('cover-image')}
                    />
                    <div className={cx('overlay')} />
                </div>
            ) : (
                <div className={cx('gradient-background')} />
            )}
            <Container size="lg">
                <div className={cx('content-container')}>
                    {props.series && (
                        <div>
                            <Badge
                                isRounded
                                className={cx('series-badge')}
                                onClick={handleClickSeries}>
                                <Text fontSize={2}>{props.series.name}</Text>
                            </Badge>
                        </div>
                    )}
                    <h1 className={cx('title')}>{props.title}</h1>
                    <div className={cx('post-info')}>
                        <Link href={`/@${props.author}`} className={cx('author-link')}>@{props.author}</Link>
                        <span className={cx('separator')}>·</span>
                        <time dateTime={props.createdDate}>
                            {props.createdDate}
                        </time>
                    </div>
                </div>
                {props.isAd && (
                    <div className={cx('ad')}>
                        유료 광고 포함
                    </div>
                )}
            </Container>
        </header>
    );
}
