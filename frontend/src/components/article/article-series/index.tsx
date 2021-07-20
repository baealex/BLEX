import React from 'react';
import Link from 'next/link';

import { SpeechBubble } from '@components/shared';

export interface ArticleSeriesProps {
    url: string;
    name: string;
    owner: string;
    ownerImage: string;
    description?: string;
    posts: {
        url: string;
        title: string;
    }[];
    sereisLength: number;
    activeSeries: number;
};

export function ArticleSeries(props: ArticleSeriesProps) {
    return (
        <div className="my-5 posts-sereis">
            <Link href="/[author]/series/[seriesurl]" as={`/@${props.owner}/series/${props.url}`}>
                <a className="deep-dark">
                    <h4 className="font-weight-bold mb-3">
                        '{props.name}' 시리즈
                    </h4>
                </a>
            </Link>
            <SpeechBubble username={props.owner} userImage={props.ownerImage}>
                {props.description ? props.description : '이 시리즈에 대한 설명이 없습니다.'}
            </SpeechBubble>
            <ul>
                {props.posts.length > 1 ? props.posts.map((post, idx) => (
                    props.activeSeries >= idx - 2 && props.activeSeries <= idx + 2 ? (
                        <li key={idx}>
                            <Link href="/[author]/[posturl]" as={`/@${props.owner}/${post.url}`}>
                                <a className={`${idx == props.activeSeries ? 'deep' : 'shallow'}-dark`}>{post.title}</a>
                            </Link>
                            <div className="series-count">{idx + 1}/{props.sereisLength}</div>
                        </li>
                    ) : ''
                )) : <></>}
            </ul>
        </div>
    )
}