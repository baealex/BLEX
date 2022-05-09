import {
    useEffect,
    useState,
} from 'react';

import ReactFrappeChart from 'react-frappe-charts';

import {
    Accordion,
    Card,
    Table,
} from '@design-system';
import type { PageComponent } from '@components';
import { SettingLayout } from '@system-design/setting';

import * as API from '@modules/api';

import { loadingStore } from '@stores/loading';

const AnalyticsSetting: PageComponent<undefined> = () => {
    const [ views, setViews ] = useState<API.GetSettingAnalyticsViewData>();
    const [ referers, setReferers ] = useState<API.GetSettingAnalyticsRefererData>();
    const [ searches, setSearches ] = useState<API.GetSettingAnalyticsSearchData>();

    useEffect(() => {
        loadingStore.start();
        Promise.all([
            API.getSettingAnalyticsView()
                .then(({ data }) => setViews(data.body)),
            API.getSettingAnalyticsSearch()
                .then(({ data }) => setSearches(data.body)),
            API.getSettingAnalyticsReferrers()
                .then(({ data }) => setReferers(data.body)),
        ]).then(() => {
            loadingStore.end();
        });
    }, []);

    return (
        <>
            {views && (
                <>
                    <div className="h5 font-weight-bold mt-lg-0 mt-3 mb-3">
                        조회수 추이
                    </div>
                    <Card hasShadow isRounded>
                        <div className="pt-3 px-3 d-flex justify-content-between">
                            <div className="ns shallow-dark">
                                총 조회수 : {views.total.toLocaleString()}
                            </div>
                            <div className="ns shallow-dark">
                                기간 : 30일 이내
                            </div>
                        </div>
                        <ReactFrappeChart
                            type="axis-mixed"
                            data={{
                                labels: views.views.map(item => item.date).reverse(),
                                datasets: [
                                    {
                                        name: 'View',
                                        values: views.views.map(item => item.count).reverse(),
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
                </>
            )}
            {searches && (
                <>
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
                                    labels: Object.keys(searches.platformTotal),
                                    datasets: [
                                        {
                                            name: 'View',
                                            values: Object.values(searches.platformTotal),
                                            chartType: 'line'
                                        }
                                    ]
                                }}
                            />
                            <div className="p-3 p-md-0">
                                <Accordion>
                                    <Table
                                        head={['유입수', '키워드', '플랫폼']}
                                        body={searches.topSearches.map((item) => [
                                            item.count.toString(),
                                            item.keyword,
                                            item.platform,
                                        ])}
                                    />
                                </Accordion>
                            </div>
                        </>
                    </Card>
                </>
            )}
            {referers && (
                <>
                    <div className="h5 font-weight-bold mt-5 mb-3">
                        신규 유입 경로
                    </div>
                    <div className="row">
                        {referers.referers.map((item, idx: number) => (
                            <div key={idx} className="col-lg-4 col-md-6">
                                <Card hasShadow isRounded className="my-3">
                                    <>
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
            )}
        </>
    );
};

AnalyticsSetting.pageLayout = (page) => (
    <SettingLayout active="analytics">
        {page}
    </SettingLayout>
);

export default AnalyticsSetting;