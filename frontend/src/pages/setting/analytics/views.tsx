import Link from 'next/link';

import ReactFrappeChart from 'react-frappe-charts';

import { Card, Loading, Text } from '@design-system';
import type { PageComponent } from '~/components';
import { SettingLayout } from '@system-design/setting';

import * as API from '~/modules/api';

import { useFetch } from '~/hooks/use-fetch';

const AnalyticsSetting: PageComponent<unknown> = () => {
    const { data: views, isLoading } = useFetch('settings/analytics/views' , async () => {
        const { data } = await API.getSettingAnalyticsView();
        return data.body;
    });

    const { data: postViews } = useFetch('settings/analytics/posts-views' , async () => {
        const { data } = await API.getSettingAnalyticsPostsView();
        return data.body;
    });

    if (isLoading) {
        return <Loading />;
    }

    return (
        <>
            {views && (
                <>
                    <Text className="my-3" fontSize={6} fontWeight={600}>
                        조회수 추이
                    </Text>
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
                    <Text className="mt-5 mb-3" fontSize={6} fontWeight={600}>
                        오늘의 인기글
                    </Text>
                    {postViews.posts.map((item, idx) => (
                        <Card key={item.url} hasBackground isRounded className="my-3">
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
                                        {item.todayCount}명 읽음
                                        <span className="ml-1" style={{ color: item.increaseCount > 0 ? '#ff6700' : '#008fff' }}>
                                            ({`${item.increaseCount > 0 ? '↑' : '↓'}${Math.abs(item.increaseCount)}`})
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
