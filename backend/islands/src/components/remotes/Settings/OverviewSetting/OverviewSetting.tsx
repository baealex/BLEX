import { useState, useEffect, useMemo, useRef } from 'react';
import { http, type Response } from '~/modules/http.module';
import { notification } from '@baejino/ui';
import { useFetch } from '~/hooks/use-fetch';
import { Button, LoadingState } from '~/components/shared';
import { Chart as FrappeCharts } from 'frappe-charts';

// Notify config labels
const NOTIFY_CONFIG_LABEL = {
    'NOTIFY_POSTS_LIKE': '다른 사용자가 내 글 추천',
    'NOTIFY_POSTS_COMMENT': '다른 사용자가 내 글에 댓글 작성',
    'NOTIFY_COMMENT_LIKE': '다른 사용자가 내 댓글 추천',
    'NOTIFY_MENTION': '다른 사용자가 댓글에서 나를 언급'
} as const;

interface Activity {
    type: 'post' | 'comment' | 'like';
    title?: string;
    postTitle?: string;
    date: string;
}

interface NotifyItem {
    id: number;
    url: string;
    isRead: boolean;
    content: string;
    createdDate: string;
}

const OverviewSetting = () => {
    const [isOpenConfig, setIsOpenConfig] = useState(false);
    const chartRef = useRef<HTMLDivElement>(null);

    // Fetch heatmap data
    const { data: heatmapData, isLoading: isHeatmapLoading } = useFetch<{ [key: string]: number }>({
        queryKey: ['dashboard-heatmap'],
        queryFn: async () => {
            const { data: response } = await http('/v1/setting/profile', { method: 'GET' });
            if (response.status === 'DONE') {
                return response.body.heatmap || {};
            }
            return {};
        }
    });

    // Fetch recent activities
    const { data: activitiesData, isLoading: isActivitiesLoading } = useFetch<{ recentActivities: Activity[] }>({
        queryKey: ['dashboard-activities'],
        queryFn: async () => {
            const { data: response } = await http('/v1/dashboard/activities', { method: 'GET' });
            if (response.status === 'DONE') {
                return response.body;
            }
            throw new Error('Failed to fetch dashboard activities');
        }
    });

    // Fetch notify list
    const { data: notifyData, isLoading: isNotifyLoading, isError: isNotifyError } = useFetch({
        queryKey: ['notify-list'],
        queryFn: async () => {
            const { data } = await http<Response<{ notify: NotifyItem[]; isTelegramSync: boolean }>>('v1/setting/notify', { method: 'GET' });
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error('알림 목록을 불러오는데 실패했습니다.');
        }
    });

    // Fetch notify config for settings modal
    const { data: notifyConfig, isLoading: isConfigLoading, isError: isConfigError, refetch: refetchConfig } = useFetch({
        queryKey: ['notify-config'],
        queryFn: async () => {
            const { data } = await http<Response<{ config: { name: string; value: boolean }[] }>>('v1/setting/notify-config', { method: 'GET' });
            if (data.status === 'DONE') {
                return data.body.config;
            }
            throw new Error('알림 설정을 불러오는데 실패했습니다.');
        },
        enable: isOpenConfig
    });

    const totalActivity = useMemo(() => {
        if (!heatmapData) return 0;
        return Object.values(heatmapData).reduce((acc, cur) => acc + cur, 0);
    }, [heatmapData]);

    // Initialize heatmap chart
    useEffect(() => {
        if (chartRef.current && heatmapData) {
            const containerWidth = chartRef.current.parentElement?.clientWidth || 800;

            const chart = new FrappeCharts(chartRef.current, {
                type: 'heatmap',
                title: `지난 1년 동안 ${totalActivity.toLocaleString()}건의 활동을 기록했습니다.`,
                data: {
                    end: new Date(),
                    dataPoints: heatmapData
                },
                width: Math.max(containerWidth, 800),
                height: 200,
                countLabel: 'Activity',
                discreteDomains: 0,
                colors: ['#ebedf0', '#c6e48b', '#7bc96f', '#239a3b', '#196127']
            });

            return () => {
                chart.destroy();
            };
        }
    }, [heatmapData, totalActivity]);

    useEffect(() => {
        if (isNotifyError) {
            notification('알림 목록을 불러오는데 실패했습니다.', { type: 'error' });
        }
    }, [isNotifyError]);

    useEffect(() => {
        if (isConfigError) {
            notification('알림 설정을 불러오는데 실패했습니다.', { type: 'error' });
        }
    }, [isConfigError]);

    const handleClickNotify = async (notify: NotifyItem) => {
        if (!notify.isRead) {
            try {
                const urlEncodedData = `id=${notify.id}`;
                await http('v1/setting/notify', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    data: urlEncodedData
                });
            } catch {
                // Silently handle error
            }
        }
        window.location.href = notify.url;
    };

    const handleToggleConfig = async (name: keyof typeof NOTIFY_CONFIG_LABEL) => {
        if (!notifyConfig) return;

        const nextState = notifyConfig.map((item) => {
            if (item.name === name) {
                return {
                    ...item,
                    value: !item.value
                };
            }
            return item;
        });

        try {
            const urlEncodedData = nextState
                .map(item => `${item.name}=${encodeURIComponent(item.value.toString())}`)
                .join('&');

            const { data } = await http('v1/setting/notify-config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                data: urlEncodedData
            });

            if (data.status === 'DONE') {
                notification('알림 설정이 업데이트 되었습니다.', { type: 'success' });
                refetchConfig();
            } else {
                notification('알림 설정 업데이트에 실패했습니다.', { type: 'error' });
            }
        } catch {
            notification('알림 설정 업데이트에 실패했습니다.', { type: 'error' });
        }
    };

    const getActivityIcon = (type: Activity['type']) => {
        switch (type) {
            case 'post':
                return {
                    icon: 'fas fa-file-alt',
                    bgColor: 'bg-black',
                    text: '새 포스트를 작성했습니다'
                };
            case 'comment':
                return {
                    icon: 'fas fa-comment',
                    bgColor: 'bg-black',
                    text: '댓글을 작성했습니다'
                };
            case 'like':
                return {
                    icon: 'fas fa-heart',
                    bgColor: 'bg-black',
                    text: '좋아요를 눌렀습니다'
                };
            default:
                return {
                    icon: 'fas fa-clock',
                    bgColor: 'bg-black',
                    text: '활동'
                };
        }
    };

    const activities = activitiesData?.recentActivities || [];
    const notifyList = notifyData?.notify || [];

    if (isHeatmapLoading || isActivitiesLoading || isNotifyLoading) {
        return <LoadingState type="list" rows={5} />;
    }

    return (
        <div className="space-y-6">
            {/* 활동 히트맵 */}
            <div className="p-6 bg-white shadow-sm rounded-2xl border border-gray-200">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
                        <i className="fas fa-fire mr-3" />
                        활동 히트맵
                    </h2>
                </div>
                <div className="w-full overflow-x-auto">
                    <div ref={chartRef} />
                </div>
            </div>

            {/* 최근 활동 & 알림 - 2열 레이아웃 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 최근 활동 */}
                <div className="p-6 bg-white shadow-sm rounded-2xl border border-gray-200">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                        <i className="fas fa-clock mr-3" />
                        최근 활동
                    </h2>

                    <div className="space-y-3">
                        {activities.length > 0 ? (
                            activities.slice(0, 5).map((activity, index) => {
                                const activityConfig = getActivityIcon(activity.type);
                                const displayTitle = activity.type === 'post' ? activity.title : activity.postTitle;

                                return (
                                    <div key={index} className="flex items-start gap-3 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all duration-300">
                                        <div className={`w-10 h-10 ${activityConfig.bgColor} rounded-xl flex items-center justify-center text-white flex-shrink-0`}>
                                            <i className={`${activityConfig.icon} text-sm`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-gray-900 text-sm mb-1">{activityConfig.text}</p>
                                            <p className="text-gray-600 truncate text-sm mb-1">"{displayTitle}"</p>
                                            <p className="text-xs text-gray-500">{activity.date}</p>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 mx-auto bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                                    <i className="fas fa-clock text-gray-400 text-2xl" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-1">아직 활동이 없습니다</h3>
                                <p className="text-gray-500 text-sm">첫 번째 포스트를 작성해보세요!</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 알림 */}
                <div className="p-6 bg-white shadow-sm rounded-2xl border border-gray-200">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                            <i className="fas fa-bell mr-3" />
                            알림
                        </h2>
                        <Button
                            variant="secondary"
                            size="md"
                            leftIcon={<i className="fas fa-cog" />}
                            onClick={() => setIsOpenConfig(true)}>
                            설정
                        </Button>
                    </div>

                    {/* Telegram integration banner */}
                    <a
                        href="/settings/integration"
                        className="block bg-gray-50 border border-gray-200 text-gray-800 px-4 py-3 rounded-2xl text-sm mb-4 hover:bg-gray-100 transition-all duration-300">
                        <div className="flex items-center">
                            <i className="fab fa-telegram-plane mr-3 text-black" />
                            <span className="font-medium">텔레그램 연동하기</span>
                        </div>
                    </a>

                    {/* Notification list */}
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {notifyList.length > 0 ? (
                            notifyList.slice(0, 5).map((item) => (
                                <div
                                    key={item.id}
                                    className="bg-gray-50 border border-gray-200 rounded-2xl p-4 cursor-pointer hover:bg-gray-100 transition-all duration-300"
                                    style={{ opacity: item.isRead ? 0.5 : 1 }}
                                    onClick={() => handleClickNotify(item)}>
                                    <div className="text-sm font-medium text-gray-900 mb-1">
                                        {item.content}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {item.createdDate}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 mx-auto bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                                    <i className="fas fa-bell text-gray-400 text-2xl" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-1">알림이 없습니다</h3>
                                <p className="text-gray-500 text-sm">새로운 알림이 도착하면 여기에 표시됩니다.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Settings Modal */}
            {isOpenConfig && (
                <div
                    className="fixed inset-0 z-50 overflow-auto bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
                    onClick={() => setIsOpenConfig(false)}>
                    <div
                        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] sm:max-h-[80vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}>
                        <div className="sticky top-0 bg-white border-b border-gray-200 rounded-t-2xl z-10">
                            <div className="flex items-center justify-between p-6">
                                <h3 className="text-xl font-bold text-gray-900">알림 설정</h3>
                                <button
                                    onClick={() => setIsOpenConfig(false)}
                                    className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            {isConfigLoading ? (
                                <div className="space-y-4">
                                    {[...Array(4)].map((_, i) => (
                                        <div key={i} className="animate-pulse">
                                            <div className="flex items-center justify-between py-3">
                                                <div className="h-4 bg-gray-200 rounded w-3/4" />
                                                <div className="h-6 w-11 bg-gray-200 rounded-full" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                notifyConfig?.map((item) => (
                                    <div key={item.name} className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                                        <span className="text-sm font-medium text-gray-900">
                                            {NOTIFY_CONFIG_LABEL[item.name as keyof typeof NOTIFY_CONFIG_LABEL]}
                                        </span>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={item.value}
                                                onChange={() => handleToggleConfig(item.name as keyof typeof NOTIFY_CONFIG_LABEL)}
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black" />
                                        </label>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OverviewSetting;
