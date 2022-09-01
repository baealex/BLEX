import ReactFrappeChart from 'react-frappe-charts';

import {
    Card,
    Table
} from '@design-system';
import type { PageComponent } from '~/components';
import { SettingLayout } from '@system-design/setting';

import * as API from '~/modules/api';

import { useFetch } from '~/hooks/use-fetch';

const AnalyticsSetting: PageComponent<unknown> = () => {
    const { data: searches } = useFetch('settings/analytics/search', async () => {
        const { data } = await API.getSettingAnalyticsSearch();
        return data.body;
    });

    return (
        <>
            {searches && (
                <>
                    <div className="h5 font-weight-bold mt-3 mb-3">
                        인기 검색어
                    </div>
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
