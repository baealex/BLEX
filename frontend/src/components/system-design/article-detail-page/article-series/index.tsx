import classNames from 'classnames/bind';
import styles from './ArticleSeries.module.scss';
const cn = classNames.bind(styles);

import React, { useRef } from 'react';
import Link from 'next/link';

import { SpeechBubble } from '@design-system';

import * as API from '~/modules/api';
import { getUserImage } from '~/modules/utility/image';
import { useFetch } from '~/hooks/use-fetch';

export interface ArticleSeriesProps {
    author: string;
    url: string;
    series?: string;
}

export function ArticleSeries(props: ArticleSeriesProps) {
    const ref = useRef<HTMLDivElement>(null);

    const { data: series } = useFetch(['series', props.author, props.series], async () => {
        if (props.series) {
            const { data: { body } } = await API.getAnUserSeries('@' + props.author, props.series);
            return body;
        }
        return null;
    }, { observeElement: ref.current });

    const seriesLength = series?.posts.length;
    const activeSeries = series?.posts.findIndex(
        (item) => item.url == props.url
    );

    return (
        <div ref={ref}>
            {series && activeSeries !== undefined && seriesLength !== undefined && (
                <div className={cn('series', 'my-5')}>
                    <Link href={`/@${props.author}/series/${props.series}`}>
                        <a className="deep-dark">
                            <div className="font-weight-bold mb-3 h5">
                                '{series.name}' 시리즈
                            </div>
                        </a>
                    </Link>
                    <SpeechBubble
                        href={`/@${series.owner}`}
                        alt={series.owner}
                        src={getUserImage(series.ownerImage)}>
                        {series.description ? series.description : '이 시리즈에 대한 설명이 없습니다.'}
                    </SpeechBubble>
                    <ul>
                        {series.posts.length > 1 && series.posts.map((post, idx) => (
                            activeSeries >= idx - 2 && activeSeries <= idx + 2 && (
                                <li key={idx}>
                                    <Link href="/[author]/[posturl]" as={`/@${series.owner}/${post.url}`}>
                                        <a
                                            className={cn(
                                                idx == activeSeries
                                                    ? 'deep-dark'
                                                    : 'shallow-dark'
                                            )}>
                                            {post.title}
                                        </a>
                                    </Link>
                                    <div className={cn('count')}>
                                        {idx + 1}/{seriesLength}
                                    </div>
                                </li>
                            )
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
