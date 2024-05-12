import { useMemo, useState } from 'react';
import Link from 'next/link';

import ReactFrappeChart from 'react-frappe-charts';

import { Alert, Button, Card, DateInput, Flex, Loading, Text } from '~/components/design-system';
import type { PageComponent } from '~/components';
import { SettingLayout } from '~/components/system-design/setting';

import * as API from '~/modules/api';

import { useFetch } from '~/hooks/use-fetch';

function getFormattedDate(date: Date) {
    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    return year + '-' + month + '-' + day;
}

const AnalyticsSetting: PageComponent<unknown> = () => {
    const [date, setDate] = useState(new Date());
    const visibleDate = useMemo(() => getFormattedDate(date), [date]);

    const { data: views, isLoading } = useFetch('settings/analytics/views', async () => {
        const { data } = await API.getSettingAnalyticsView();
        return {
            ...data.body,
            dates: data.body.views.map(item => item.date).reverse(),
            counts: data.body.views.map(item => item.count).reverse()
        };
    });

    const { data: postViews, isLoading: isLoadingPostsView } = useFetch(['settings/analytics/posts-views', visibleDate], async () => {
        const { data } = await API.getSettingAnalyticsPostsView({ date: visibleDate });
        return data.body;
    }, { disableRefetch: true });

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
                        <Flex justify="between" className="pt-3 px-3">
                            <div className="ns shallow-dark">
                                총 조회수 : {views.total.toLocaleString()}
                            </div>
                            <div className="ns shallow-dark">
                                기간 : 30일 이내
                            </div>
                        </Flex>
                        <ReactFrappeChart
                            type="axis-mixed"
                            data={{
                                labels: views.dates,
                                datasets: [
                                    {
                                        name: 'View',
                                        values: views.counts,
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
            {isLoadingPostsView && (
                <Flex justify="center" className="mt-5 p-3">
                    <Loading position="inline" />
                </Flex>
            )}
            {!isLoadingPostsView && postViews && (
                <>
                    <Flex
                        className="mt-5 mb-3"
                        justify="between"
                        align="center"
                        wrap="wrap"
                        gap={3}>
                        <Flex wrap="wrap" align="center" gap={2}>
                            <DateInput
                                selected={date}
                                onChange={setDate}
                                minDate={new Date(new Date().setDate(new Date().getDate() - 30))}
                                maxDate={new Date()}
                                style={{ width: '100px' }}
                            />
                            <Text fontSize={6} fontWeight={600}>
                                의 인기글
                            </Text>
                        </Flex>
                        <div>
                            <Button
                                className="mr-2"
                                disabled={date <= new Date(new Date().setDate(new Date().getDate() - 30))}
                                onClick={() => setDate(new Date(date.setDate(new Date(date).getDate() - 1)))}>
                                이전
                            </Button>
                            <Button
                                disabled={date >= new Date(new Date().setDate(new Date().getDate() - 1))}
                                onClick={() => setDate(new Date(date.setDate(new Date(date).getDate() + 1)))}>
                                다음
                            </Button>
                        </div>
                    </Flex>
                    {postViews.posts.length === 0 && (
                        <Alert className="mb-5">
                            아직 작성한 포스트가 없습니다.
                        </Alert>
                    )}
                    {postViews.posts.map((item, idx) => (
                        <Card key={item.url} hasBackground isRounded className="my-3 p-3">
                            <Flex justify="between" align="center" wrap="wrap" gap={2}>
                                <Link className="deep-dark" href={`/@${item.author}/${item.url}`}>
                                    {`${idx + 1}. ${item.title}`}
                                </Link>
                                <div className="ns">
                                    {item.todayCount}명 읽음
                                    <span className="ml-1" style={{ color: item.increaseCount > 0 ? '#ff6700' : '#008fff' }}>
                                        ({`${item.increaseCount > 0 ? '↑' : '↓'}${Math.abs(item.increaseCount)}`})
                                    </span>
                                </div>
                            </Flex>
                        </Card>
                    ))}
                </>
            )
            }
        </>
    );
};

AnalyticsSetting.pageLayout = (page) => (
    <SettingLayout active="analytics/views">
        {page}
    </SettingLayout>
);

export default AnalyticsSetting;
