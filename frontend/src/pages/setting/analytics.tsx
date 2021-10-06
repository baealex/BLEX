import React from 'react';
import ReactFrappeChart from 'react-frappe-charts';

import { Layout } from '@components/setting';

import * as API from '@modules/api';

import { GetServerSidePropsContext } from 'next';
import { Card } from '@components/atoms';

interface Props extends
    API.GetSettingAnalyticsViewData,
    API.GetSettingAnalyticsRefererData, 
    API.GetSettingAnalyticsgSearchData {}

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const { req, res } = context;
    const views = await API.getSettingAnalyticsView(req.headers.cookie);
    if (views.data.status === 'ERROR') {
        res.writeHead(302, { Location: '/' });
        res.end();
    }
    const referers = await API.getSettingAnalyticsReferrers(req.headers.cookie, 1);
    const searches = await API.getSettingAnalyticsSearch(req.headers.cookie);
    return {
        props: {
            ...views.data.body,
            ...referers.data.body,
            ...searches.data.body,
        }
    };
}

export default function AnalyticsSetting(props: Props) {
    return (
        <>
            <div className="h5 font-weight-bold mt-lg-0 mt-3 mb-3">
                조회수 추이
            </div>
            <Card hasShadow isRounded>
                <div className="pt-3 px-3 d-flex justify-content-between">
                    <div className="ns shallow-dark">
                        총 조회수 : {props.total.toLocaleString()}
                    </div>
                    <div className="ns shallow-dark">
                        기간 : 30일 이내
                    </div>
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
                    colors={['#A076F1']}
                    lineOptions={{
                        hideDots: 1
                    }}
                    axisOptions={{
                        xIsSeries: 1
                    }}
                />
            </Card>
            <div className="h5 font-weight-bold mt-5 mb-3">
                검색 유입 분석
            </div>
            <Card hasShadow isRounded>
                <>
                    <div className="pt-3 px-3">
                        <div className="ns shallow-dark text-right">
                            기간 : 30일 이내
                        </div>
                    </div>
                    <ReactFrappeChart
                        type="pie"
                        data={{
                            labels: Object.keys(props.platformTotal),
                            datasets: [
                                {
                                    name: 'View',
                                    values: Object.values(props.platformTotal),
                                    chartType: 'line'
                                }
                            ]
                        }}
                    />
                    <div className="p-3 p-md-0">
                        <div className="table_wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>횟수</th>
                                        <th>검색어</th>
                                        <th>출처</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {props.topSearches.map((item, idx) => (
                                        <tr key={idx}>
                                            <td data-title="횟수">{item.count}</td>
                                            <td data-title="검색어">{item.keyword}</td>
                                            <td data-title="출처">{item.platform}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <style jsx>{`
                            .table_wrap {
                                overflow: hidden;
                            }

                            table {
                                width: 100% !important;
                            }

                            thead {
                                color: #fff;
                                background: #A076F1;

                                :global(body.dark) & {
                                    background: #555;
                                }

                                @media (max-width: 767px) {
                                    display: none;
                                }
                            }

                            tbody {
                                color: #666;

                                :global(body.dark) & {
                                    color: #ccc;
                                }
                            }

                            th, td {
                                line-height: 1.2;
                                font-weight: unset !important;
                                padding: 15px 0;
                                text-align: center;

                                @media (max-width: 767px) {
                                    text-align: left;
                                    display: block;
                                    padding: 8px 0;
                                }
                            }

                            td::before {
                                @media (max-width: 767px) {
                                    font-size: 12px;
                                    color: #aaa;
                                    line-height: 1.2;
                                    margin-bottom: 12px;
                                    content: attr(data-title);
                                    min-width: 98px;
                                    display: block;

                                    :global(body.dark) & {
                                        color: #888;
                                    }
                                }
                            }

                            tbody tr:not(:last-child) {
                                border-bottom: 1px solid #f2f2f2;

                                :global(body.dark) & {
                                    border-bottom: 1px solid #555;
                                }
                            }

                            tr > *:nth-child(1) {
                                @media (min-width: 768px) {
                                    width: 80px;
                                    padding-left: 20px;
                                }
                            }
                        `}</style>
                    </div>
                </>
            </Card>
            <div className="h5 font-weight-bold mt-5 mb-3">
                신규 유입 경로
            </div>
            <div className="row">
                {props.referers.map((item, idx: number) => (
                    <div key={idx} className="col-lg-4 col-md-6">
                        <Card hasShadow isRounded className="my-3">
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
        </>
    );
}

AnalyticsSetting.pageLayout = (page: JSX.Element) => (
    <Layout tabname="analytics">
        {page}
    </Layout>
)