import classNames from 'classnames/bind';
import styles from './ArticleSeries.module.scss';
const cx = classNames.bind(styles);

import React, { useRef } from 'react';
import Link from 'next/link';

import { Flex, SpeechBubble, Text } from '~/components/design-system';

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

    const { data: series } = useFetch(['series', props.author, props.series?.url], async () => {
        if (props.series) {
            const { data: { body } } = await API.getAnUserSeries('@' + props.author, props.series.url, { kind: 'continue' });
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
                <div className={cx('series', 'py-5')}>
                    <Flex
                        className="mb-3"
                        justify="between"
                        align="center"
                        wrap="wrap"
                        gap={2}>
                        <Text className="title-2-spacing" fontWeight={600} fontSize={5}>
                            “{series.name}” 시리즈
                        </Text>
                        <Link className="shallow-dark" href={`/@${props.author}/series/${series.url}`}>
                            <Text>
                                전체 목록<i className="fas fa-angle-right ml-1" />
                            </Text>
                        </Link>
                    </Flex>
                    <SpeechBubble
                        image={(
                            <Link href={`/@${series.owner}`}>
                                <img className="rounded-full" src={getUserImage(series.ownerImage)} />
                            </Link>
                        )}>
                        {series.description ? series.description : '이 시리즈에 대한 설명이 없습니다.'}
                    </SpeechBubble>
                    <ul>
                        {series.posts.length > 1 && series.posts.map((post, idx) => (
                            activeSeries >= idx - 2 && activeSeries <= idx + 2 && (
                                <li key={idx}>
                                    <div className={cx('count')}>
                                        {idx + 1}/{seriesLength}
                                    </div>
                                    <Link
                                        className={cx(
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
