import classNames from 'classnames/bind';
import styles from './ArticleCover.module.scss';
const cn = classNames.bind(styles);

import { ImagePreload } from '@design-system';
import { getPostsImage } from '~/modules/utility/image';

export function ArticleCover(props: {
    series?: string;
    image?: string;
    title: string;
    isAd: boolean;
    createdDate: string;
    updatedDate: string;
}) {
    if (!props.image) {
        return (
            <header className={cn('no-cover', 'd-flex', 'align-items-end')}>
                <div className="container">
                    <div className="row justify-content-center">
                        <div className="col-lg-8">
                            {props.series && (
                                <span data-label={`‘${props.series}’ 시리즈`}/>
                            )}
                            <h1>{props.title}</h1>
                            <time dateTime={props.createdDate}>
                                {props.createdDate}
                                {props.createdDate !== props.updatedDate && ` (Updated: ${props.updatedDate})`}
                            </time>
                        </div>
                    </div>
                </div>
            </header>
        );
    }

    return (
        <header className={cn('full-cover')}>
            <div className={cn('image-cover')}>
                <ImagePreload links={[getPostsImage(props.image)]} />
                <div style={{ backgroundImage: 'url('+ getPostsImage(props.image) + ')' }}/>
            </div>
            <div className={cn('inner')}>
                <div className={cn('container')}>
                    {props.series && (
                        <span data-label={`‘${props.series}’ 시리즈`}/>
                    )}
                    <h1>{props.title}</h1>
                    <time>
                        {props.createdDate}
                        {props.createdDate !== props.updatedDate && ` (Updated: ${props.updatedDate})`}
                    </time>
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
