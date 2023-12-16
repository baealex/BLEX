import classNames from 'classnames/bind';
import styles from './ArticleSeries.module.scss';
const cn = classNames.bind(styles);

import React, { useRef } from 'react';
import Link from 'next/link';

import { SpeechBubble, Text } from '@design-system';

import * as API from '~/modules/api';
import { getUserImage } from '~/modules/utility/image';
import { useFetch } from '~/hooks/use-fetch';

export interface ArticleSeriesProps {
    author: string;
    url: string;
    series?: {
        url: string;
        name: string;
    };
}

export function ArticleSeries(props: ArticleSeriesProps) {
    const ref = useRef<HTMLDivElement>(null);

    const { data: series } = useFetch(['series', props.author, props.series], async () => {
        if (props.series) {
            const { data: { body } } = await API.getAnUserSeries('@' + props.author, props.series.url, {
                kind: 'continue'
            });
            return body;
        }
        return null;
    }, { observeRef: ref });

    const seriesLength = series?.posts.length;
    const activeSeries = series?.posts.findIndex(
        (item) => item.url == props.url
    );

    return (
        <div ref={ref}>
            {series && activeSeries !== undefined && seriesLength !== undefined && (
                <div className={cn('series', 'my-5')}>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <Text className="title-2-spacing" fontWeight={600} fontSize={5}>
                            “{series.name}” 시리즈
                        </Text>
                        <Link className="shallow-dark" href={`/@${props.author}/series/${props.series}`}>
                            <Text>
                                전체 목록<i className="fas fa-angle-right ml-1" />
                            </Text>
                        </Link>
                    </div>
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
                                    <div className={cn('count')}>
                                        {idx + 1}/{seriesLength}
                                    </div>
                                    <Link
                                        className={cn(
                                            'title-3-spacing',
                                            idx == activeSeries
                                                ? 'deep-dark'
                                                : 'shallow-dark'
                                        )}
                                        href={`/@${series.owner}/${post.url}`}>
                                        <Text>
                                            {post.title}
                                        </Text>
                                    </Link>
                                </li>
                            )
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
