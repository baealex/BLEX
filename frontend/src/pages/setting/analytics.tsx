import React from 'react';
import ReactFrappeChart from 'react-frappe-charts';

import { Layout } from '@components/setting';

import * as API from '@modules/api';

import { GetServerSidePropsContext } from 'next';
import { Card } from '@components/atoms';

interface Props extends API.GetSettingViewData, API.GetSettingRefererData {}

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const { req, res } = context;
    const views = await API.getSettingView(req.headers.cookie);
    if (views.data.status === 'ERROR') {
        res.writeHead(302, { Location: '/' });
        res.end();
    }
    const referers = await API.getSettingReferrers(req.headers.cookie, 1);
    return {
        props: {
            ...views.data.body,
            ...referers.data.body
        }
    };
}

export default function AnalyticsSetting(props: Props) {
    return (
        <>
            <Layout tabname="analytics">
                <div className="h5 noto font-weight-bold mb-3">
                    조회수 추이
                </div>
                <Card isRounded className="p-3">
                    <div className="ns shallow-dark text-right">
                        총 조회수 : {props.total.toLocaleString()}
                    </div>
                    <ReactFrappeChart
                        type="axis-mixed"
                        data={{
                            labels: props.views.map(item => item.date).reverse(),
                            datasets: [
                                {
                                    name: 'View',
                                    values: props.views.map(item => item.count).reverse(),
                                    chartType: 'line'
                                }
                            ]
                        }}
                        colors={['purple']}
                    />
                </Card>
                <div className="h5 noto font-weight-bold mt-5 mb-3">
                    신규 유입 경로
                </div>
                <div className="row">
                    {props.referers.map((item, idx: number) => (
                        <div key={idx} className="col-lg-4 col-md-6">
                            <Card isRounded className="my-3">
                                <>
                                    {item.image && (
                                        <div>
                                            <a className="deep-dark" href={item.url} target="blank">
                                                <img className="w-100 h-150 fit-cover" src={item.image}/>
                                            </a>
                                        </div>
                                    )}
                                    <div className="p-3">
                                        <div>
                                            <a className="deep-dark" href={item.url} target="blank">
                                                {item.title ? item.title : item.url}
                                            </a>
                                        </div>
                                        {item.description && (
                                            <div className="ns">
                                                <a className="shallow-dark" href={item.url} target="blank">
                                                    {item.description}
                                                </a>
                                            </div>
                                        )}
                                        <div className="ns gray-dark">
                                            {item.time}
                                        </div>
                                    </div>
                                </>
                            </Card>
                        </div>
                    ))}
                </div>
            </Layout>
        </>
    );
}