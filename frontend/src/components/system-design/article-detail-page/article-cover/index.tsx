import classNames from 'classnames/bind';
import styles from './ArticleCover.module.scss';
const cn = classNames.bind(styles);

import Link from 'next/link';
import { useRouter } from 'next/router';

import { getPostsImage } from '~/modules/utility/image';

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
        if (props.series?.url) {
            router.push(`/@${props.author}/series/${props.series.url}`);
        }
    };

    if (!props.image) {
        return (
            <header className={cn('no-cover')}>
                <div className="x-container h-100 d-flex flex-column justify-content-end">
                    {props.series && (
                        <span
                            className={cn('series')}
                            onClick={handleClickSeries}
                            data-label={`‘${props.series.name}’ 시리즈`}
                        />
                    )}
                    <h1>{props.title}</h1>
                    <div className={cn('post-info')}>
                        <Link href={`/@${props.author}`}>@{props.author}</Link>
                        ·
                        <time dateTime={props.createdDate}>
                            {props.createdDate}
                        </time>
                    </div>
                </div>
            </header>
        );
    }

    return (
        <header className={cn('full-cover')}>
            <div className={cn('image-cover')}>
                <img
                    className={'lazy'}
                    src={getPostsImage(props.image, { minify: true })}
                    data-src={getPostsImage(props.image)}
                />
            </div>
            <div className={cn('inner')}>
                <div className={cn('container')}>
                    {props.series && (
                        <span
                            className={cn('series')}
                            onClick={handleClickSeries}
                            data-label={`‘${props.series}’ 시리즈`}
                        />
                    )}
                    <h1>{props.title}</h1>
                    <div className={cn('post-info')}>
                        <Link href={`/@${props.author}`}>@{props.author}</Link>
                        ·
                        <time dateTime={props.createdDate}>
                            {props.createdDate}
                        </time>
                    </div>
                </div>
            </div>
            {props.isAd && (
                <div className={cn('ad')}>
                    유료 광고 포함
                </div>
            )}
        </header>
    );
}
