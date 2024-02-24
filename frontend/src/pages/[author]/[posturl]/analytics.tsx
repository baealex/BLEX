import type { GetServerSideProps } from 'next';
import React from 'react';

import ReactFrappeChart from 'react-frappe-charts';

import {
    Alert,
    Card,
    Flex,
    Text
} from '@design-system';

import * as API from '~/modules/api';
import { useFetch } from '~/hooks/use-fetch';

interface Props {
    author: string;
    posturl: string;
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ query }) => {
    const { author = '', posturl = '' } = query as {
        [key: string]: string;
    };

    if (!author.startsWith('@') || !posturl) {
        return { notFound: true };
    }

    return {
        props: {
            author,
            posturl
        }
    };
};

function PostsAnalytics(props: Props) {
    const { data } = useFetch(['posts', 'analytics', props.posturl], async () => {
        const { data } = await API.getPostAnalytics(props.posturl);
        return {
            ...data.body,
            dates: data.body.items.map(item => item.date).reverse(),
            counts: data.body.items.map(item => item.count).reverse()
        };
    });

    return data && (
        <div className="x-container">
            <Text className="my-3" fontSize={6} fontWeight={600}>
                조회수 추이
            </Text>
            <Card hasBackground isRounded className="mb-5">
                <Flex justify="end" className="pt-3 px-3">
                    <div className="ns shallow-dark">
                        기간 : 7일 이내
                    </div>
                </Flex>

                <ReactFrappeChart
                    type="axis-mixed"
                    data={{
                        labels: data.dates,
                        datasets: [
                            {
                                name: 'View',
                                values: data.counts,
                                chartType: 'line'
                            }
                        ]
                    }}
                    colors={['purple']}
                />
            </Card>

            <Text className="my-3" fontSize={6} fontWeight={600}>
                방문자 평가
            </Text>
            {data?.thanks.positiveCount === 0 && data?.thanks.negativeCount === 0 ? (
                <Alert className="mb-5">
                    최근 평가한 방문자 없습니다.
                </Alert>
            ) : (
                <Card hasBackground isRounded className="mb-5">
                    <Flex justify="end" className="pt-3 px-3">
                        <div className="ns shallow-dark">
                            기간 : 30일 이내
                        </div>
                    </Flex>

                    <ReactFrappeChart
                        type="pie"
                        colors={['#5cd65c', '#ff0000']}
                        data={{
                            labels: ['긍정', '부정'],
                            datasets: [
                                {
                                    name: 'View',
                                    values: [data?.thanks.positiveCount, data?.thanks.negativeCount],
                                    chartType: 'line'
                                }
                            ]
                        }}
                    />
                </Card>
            )}

            <Text className="my-3" fontSize={6} fontWeight={600}>
                신규 유입 경로
            </Text>
            {data?.referers.length === 0 && (
                <Alert className="mb-5">
                    신규 유입 경로가 없습니다.
                </Alert>
            )}
            <ul className="mb-5">
                {data?.referers.map((item, idx) => (
                    <li key={idx}>
                        {item.time} - <a className="shallow-dark" href={item.from} target="blank">{item.title ? item.title : item.from}</a>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default PostsAnalytics;
