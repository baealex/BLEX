import ReactFrappeChart from 'react-frappe-charts';

import {
    Card,
    Loading,
    Table,
    Text
} from '~/components/design-system';
import type { PageComponent } from '~/components';
import { SettingLayout } from '~/components/system-design/setting';

import * as API from '~/modules/api';

import { useFetch } from '~/hooks/use-fetch';

const AnalyticsSetting: PageComponent<unknown> = () => {
    const { data: searches, isLoading } = useFetch('settings/analytics/search', async () => {
        const { data } = await API.getSettingAnalyticsSearch();
        return data.body;
    });

    if (isLoading) {
        return <Loading />;
    }

    return (
        <>
            {searches && (
                <>
                    <Text className="my-3" fontSize={6} fontWeight={600}>
                        인기 검색어
                    </Text>
                    <Card hasBackground isRounded>
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
                            <Table
                                head={['유입수', '키워드', '플랫폼']}
                                body={searches.topSearches.map((item) => [
                                    item.count.toString(),
                                    item.keyword,
                                    item.platform
                                ])}
                            />
                        </div>
                    </Card>
                </>
            )}
        </>
    );
};

AnalyticsSetting.pageLayout = (page) => (
    <SettingLayout active="analytics/search">
        {page}
    </SettingLayout>
);

export default AnalyticsSetting;
