import Link from 'next/link';
import { useState } from 'react';

import ReactFrappeChart from 'react-frappe-charts';

import { Card } from '@design-system';
import type { PageComponent } from '@components';
import { SettingLayout } from '@system-design/setting';

import * as API from '@modules/api';

import { loadingStore } from '@stores/loading';
import { useLoginCheck } from '@hooks/use-login-check';

const AnalyticsSetting: PageComponent<unknown> = () => {
    const [ views, setViews ] = useState<API.GetSettingAnalyticsViewResponseData>();
    const [ postViews, setPostViews ] = useState<API.GetSettingAnalyticsPostsViewResponseData>();

    useLoginCheck({
        loginRequired: { redirect: '/' },
        onSuccess: () => {
            loadingStore.start(),
            Promise.all([
                API.getSettingAnalyticsView()
                    .then(({ data }) => setViews(data.body)),
                API.getSettingAnalyticsPostsView()
                    .then(({ data }) => setPostViews(data.body))
            ]).finally(() => {
                loadingStore.end();
            });
        }
    });

    return (
        <>
            {views && (
                <>
                    <div className="h5 font-weight-bold mt-lg-0 mt-3 mb-3">
                        조회수 추이
                    </div>
                    <Card hasBackground isRounded>
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
                            lineOptions={{ hideDots: 1 }}
                            axisOptions={{ xIsSeries: 1 }}
                        />
                    </Card>
                </>
            )}
            {postViews && (
                <>
                    <div className="h5 font-weight-bold mt-5 mb-3">
                        오늘의 인기글
                    </div>
                    {postViews.posts.map((item, idx) => (
                        <Card key={item.id} hasBackground isRounded className="my-3">
                            <div className="p-3">
                                <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: '8px' }}>
                                    <div>
                                        <Link href={`/@${item.author}/${item.url}`}>
                                            <a className="deep-dark">
                                                {`${idx + 1}. ${item.title}`}
                                            </a>
                                        </Link>
                                    </div>
                                    <div className="ns">
                                        {item.today}명 읽음
                                        <span className="ml-1" style={{ color: item.increaseRate < 0 ? '#008fff' : '#ff6700' }}>
                                            ({item.increaseRate}%)
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </>
            )}
        </>
    );
};

AnalyticsSetting.pageLayout = (page) => (
    <SettingLayout active="analytics/views">
        {page}
    </SettingLayout>
);

export default AnalyticsSetting;
