import styles from './ArticleCover.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import { useEffect } from 'react';

export function ArticleCover(props: {
    series?: string;
    image: string;
    title: string;
    createdDate: string;
    updatedDate: string;
}) {
    useEffect(() => {

    }, [props.image])

    return (
        <div className={cn('full-cover')}>
            <div className={cn('image-cover')}>
                <div style={props.image ? {
                    backgroundImage: 'url(https://static.blex.me/' + props.image + ')'
                } : undefined}></div>
            </div>
            <div className={cn('inner')}>
                <div className={cn('container')}>
                    {props.series && (
                        <span>‘{props.series}’ 시리즈</span>
                    )}
                    <h1>{props.title}</h1>
                    <time className="post-date">
                        {props.createdDate}
                        {props.createdDate !== props.updatedDate && ` (Updated: ${props.updatedDate})`}
                    </time>
                </div>
            </div>
        </div>
    )
}