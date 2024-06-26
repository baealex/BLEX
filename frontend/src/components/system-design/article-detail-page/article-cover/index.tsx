import classNames from 'classnames/bind';
import styles from './ArticleCover.module.scss';
const cx = classNames.bind(styles);

import Link from 'next/link';
import { useRouter } from 'next/router';

import { Container, Flex, LazyLoadedImage } from '~/components/design-system';

import { getPostImage } from '~/modules/utility/image';

export function ArticleCover(props: {
    author: string;
    series?: {
        url: string;
        name: string;
    };
    image?: string;
    title: string;
    isAd: boolean;
    createdDate: string;
}) {
    const router = useRouter();

    const handleClickSeries = () => {
        if (props.series) {
            router.push(`/@${props.author}/series/${props.series.url}`);
        }
    };

    if (!props.image) {
        return (
            <header className={cx('no-cover')}>
                <Container size="sm">
                    <Flex direction="column" justify="end" className="h-100">
                        {props.series && (
                            <span
                                className={cx('series')}
                                onClick={handleClickSeries}
                                data-label={`‘${props.series.name}’ 시리즈`}
                            />
                        )}
                        <h1>{props.title}</h1>
                        <div className={cx('post-info')}>
                            <Link href={`/@${props.author}`}>@{props.author}</Link>
                            ·
                            <time dateTime={props.createdDate}>
                                {props.createdDate}
                            </time>
                        </div>
                    </Flex>
                </Container>
            </header>
        );
    }

    return (
        <header className={cx('full-cover')}>
            <div className={cx('image-cover')}>
                <LazyLoadedImage
                    previewImage={getPostImage(props.image, { minify: true })}
                    src={getPostImage(props.image)}
                    alt={props.title}
                />
            </div>
            <div className={cx('inner')}>
                <div className={cx('container')}>
                    {props.series && (
                        <span
                            className={cx('series')}
                            onClick={handleClickSeries}
                            data-label={`‘${props.series.name}’ 시리즈`}
                        />
                    )}
                    <h1>{props.title}</h1>
                    <div className={cx('post-info')}>
                        <Link href={`/@${props.author}`}>@{props.author}</Link>
                        ·
                        <time dateTime={props.createdDate}>
                            {props.createdDate}
                        </time>
                    </div>
                </div>
            </div>
            {props.isAd && (
                <div className={cx('ad')}>
                    유료 광고 포함
                </div>
            )}
        </header>
    );
}
