import type { GetServerSideProps } from 'next';
import React from 'react';

import ReactFrappeChart from 'react-frappe-charts';

import {
    Alert,
    Card,
    Text
} from '@design-system';

import * as API from '~/modules/api';
import { useFetch } from '~/hooks/use-fetch';

export const getServerSideProps: GetServerSideProps = async ({ req, query }) => {
    const { author = '', posturl = '' } = query;

    if (!author.includes('@') || !posturl) {
        return { notFound: true };
    }

    return {
        props: {
            author,
            posturl
        }
    };
};

interface Props {
    author: string;
    posturl: string;
}

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
                <div className="pt-3 px-3 d-flex justify-content-between">
                    <div className="ns shallow-dark">

                    </div>
                    <div className="ns shallow-dark">
                        기간 : 7일 이내
                    </div>
                </div>

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
                신규 유입 경로
            </Text>
            {data?.referers.length === 0 ? (
                <Alert className="mb-5">
                    신규 유입 경로가 없습니다.
                </Alert>
            ) : (
                <ul className="mb-5">
                    {data?.referers.map((item, idx) => (
                        <li key={idx}>
                            {item.time} - <a className="shallow-dark" href={item.from} target="blank">{item.title ? item.title : item.from}</a>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default PostsAnalytics;
