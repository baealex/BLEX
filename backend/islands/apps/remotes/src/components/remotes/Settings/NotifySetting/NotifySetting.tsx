import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import NotificationsSection from './components/NotificationsSection';
import NotifyConfigModal from './components/NotifyConfigModal';
import {
    getNotifications,
    getNotifyConfig,
    type Activity
} from '~/lib/api/settings';

export type { Activity };

const NotifySetting = () => {
    const [isOpenConfig, setIsOpenConfig] = useState(false);

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

    const notifyList = notifyData?.notify || [];

    return (
        <div className="space-y-6">
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

export default NotifySetting;
