import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import HeatmapSection from './components/HeatmapSection';
import RecentActivitiesSection from './components/RecentActivitiesSection';
import NotificationsSection from './components/NotificationsSection';
import NotifyConfigModal from './components/NotifyConfigModal';
import {
    getHeatmap,
    getRecentActivities,
    getNotifications,
    getNotifyConfig,
    type Activity
} from '~/lib/api/settings';

export type { Activity };

const OverviewSetting = () => {
    const [isOpenConfig, setIsOpenConfig] = useState(false);

    // Fetch heatmap data
    const { data: heatmapData, isLoading: isHeatmapLoading } = useQuery<{ [key: string]: number }>({
        queryKey: ['dashboard-heatmap'],
        queryFn: async () => {
            const { data: response } = await getHeatmap();
            if (response.status === 'DONE') {
                // Fix date format: humps.camelize converts '2024-11-21' to '20241121'
                // We need to convert it back to 'YYYY-MM-DD' format for Frappe Charts
                const rawHeatmap = response.body || {};
                const fixedHeatmap: { [key: string]: number } = {};

                Object.entries(rawHeatmap).forEach(([date, count]) => {
                    const numCount = Number(count);
                    // Check if date is in YYYYMMDD format (8 digits)
                    if (/^\d{8}$/.test(date)) {
                        // Convert 20241121 -> 2024-11-21
                        const fixedDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
                        fixedHeatmap[fixedDate] = numCount;
                    } else {
                        // Keep date as-is if it's already in correct format
                        fixedHeatmap[date] = numCount;
                    }
                });

                return fixedHeatmap;
            }
            return {};
        }
    });

    // Fetch recent activities
    const { data: activitiesData, isLoading: isActivitiesLoading } = useQuery<{ recentActivities: Activity[] }>({
        queryKey: ['dashboard-activities'],
        queryFn: async () => {
            const { data: response } = await getRecentActivities();
            if (response.status === 'DONE') {
                return response.body;
            }
            throw new Error('Failed to fetch dashboard activities');
        }
    });

    // Fetch notify list
    const { data: notifyData, isLoading: isNotifyLoading, isError: isNotifyError } = useQuery({
        queryKey: ['notify-list'],
        queryFn: async () => {
            const { data } = await getNotifications();
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error('알림 목록을 불러오는데 실패했습니다.');
        }
    });

    // Fetch notify config for settings modal
    const { data: notifyConfig, isLoading: isConfigLoading, isError: isConfigError, refetch: refetchConfig } = useQuery({
        queryKey: ['notify-config'],
        queryFn: async () => {
            const { data } = await getNotifyConfig();
            if (data.status === 'DONE') {
                return data.body.config;
            }
            throw new Error('알림 설정을 불러오는데 실패했습니다.');
        },
        enabled: isOpenConfig
    });

    const activities = activitiesData?.recentActivities || [];
    const notifyList = notifyData?.notify || [];

    return (
        <div className="space-y-6">
            {/* 활동 히트맵 */}
            <HeatmapSection
                heatmapData={heatmapData}
                isLoading={isHeatmapLoading}
            />

            {/* 최근 활동 */}
            <RecentActivitiesSection
                activities={activities}
                isLoading={isActivitiesLoading}
            />

            {/* 알림 */}
            <NotificationsSection
                notifyList={notifyList}
                isLoading={isNotifyLoading}
                isError={isNotifyError}
                onOpenConfig={() => setIsOpenConfig(true)}
            />

            {/* Settings Modal */}
            <NotifyConfigModal
                isOpen={isOpenConfig}
                onClose={() => setIsOpenConfig(false)}
                notifyConfig={notifyConfig}
                isLoading={isConfigLoading}
                isError={isConfigError}
                refetch={refetchConfig}
            />
        </div>
    );
};

export default OverviewSetting;
