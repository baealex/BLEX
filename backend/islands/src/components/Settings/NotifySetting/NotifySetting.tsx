import { useState, useEffect } from 'react';
import { http, type Response } from '~/modules/http.module';
import { notification } from '@baejino/ui';
import { useFetch } from '~/hooks/use-fetch';

const NOTIFY_CONFIG_LABEL = {
    'NOTIFY_POSTS_LIKE': '다른 사용자가 내 글 추천',
    'NOTIFY_POSTS_COMMENT': '다른 사용자가 내 글에 댓글 작성',
    'NOTIFY_COMMENT_LIKE': '다른 사용자가 내 댓글 추천',
    'NOTIFY_MENTION': '다른 사용자가 댓글에서 나를 언급'
} as const;

const NotifySetting = () => {
    const [isOpenConfig, setIsOpenConfig] = useState(false);

    // Fetch notify list
    const { data: notifyList, isLoading: isNotifyLoading, isError: isNotifyError } = useFetch({
        queryKey: ['notify-list'],
        queryFn: async () => {
            const { data } = await http<Response<{ notify: { id: number; url: string; isRead: boolean; content: string; createdDate: string }[]; isTelegramSync: boolean }>>('v1/setting/notify', { method: 'GET' });
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

    const handleClickNotify = async (notify: { id: number; url: string; isRead: boolean }) => {
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

    if (isNotifyLoading) {
        return (
            <div className="p-4 sm:p-6 bg-white shadow-sm rounded-lg">
                <div className="animate-pulse">
                    <div className="flex flex-col sm:flex-row justify-end mb-4 gap-2">
                        <div className="h-10 sm:h-10 w-full sm:w-32 bg-gray-200 rounded-md" />
                        <div className="h-10 sm:h-10 w-full sm:w-24 bg-gray-200 rounded-md" />
                    </div>
                    <div className="space-y-3 sm:space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4">
                                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                                <div className="h-3 bg-gray-200 rounded w-1/2" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 bg-white shadow-sm rounded-lg">
            {/* Header with telegram integration and settings button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between mb-4 gap-3 sm:gap-4">
                <a href="/settings/integration" className="bg-gray-50 border border-solid border-gray-200 text-gray-800 px-4 py-3 rounded-md text-sm flex items-center flex-1 min-h-[48px]">
                    <i className="fab fa-telegram-plane mr-2" />
                    텔레그램을 연동하여 실시간 알림을 받아보세요.
                </a>
                <button
                    onClick={() => setIsOpenConfig(true)}
                    className="inline-flex items-center justify-center px-4 py-3 border border-solid border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors touch-manipulation min-h-[48px] w-full sm:w-auto">
                    <i className="fas fa-cog mr-2" />
                    알림 설정
                </button>
            </div>

            {/* Notification list */}
            <div className="space-y-3">
                {notifyList?.notify.map((item) => (
                    <div
                        key={item.id}
                        className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4 cursor-pointer hover:bg-gray-100 transition-colors touch-manipulation"
                        style={{ opacity: item.isRead ? 0.4 : 1 }}
                        onClick={() => handleClickNotify(item)}>
                        <div className="text-sm text-gray-900 mb-1">
                            {item.content}
                        </div>
                        <div className="text-xs text-gray-500">
                            {item.createdDate}
                        </div>
                    </div>
                ))}
                {notifyList?.notify.length === 0 && (
                    <div className="text-center py-8 sm:py-12 text-gray-500">
                        <svg className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 2L3 7v11a2 2 0 002 2h4v-6h2v6h4a2 2 0 002-2V7l-7-5z" />
                        </svg>
                        <p>알림이 없습니다.</p>
                    </div>
                )}
            </div>

            {/* Settings Modal */}
            {isOpenConfig && (
                <div
                    className="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
                    onClick={() => setIsOpenConfig(false)}>
                    <div
                        className="bg-white rounded-t-lg sm:rounded-lg shadow-xl max-w-md w-full max-h-[85vh] sm:max-h-[80vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900">알림 설정</h3>
                            <button
                                onClick={() => setIsOpenConfig(false)}
                                className="text-gray-400 hover:text-gray-500 p-1 touch-manipulation">
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
                            {isConfigLoading ? (
                                <div className="space-y-4">
                                    {[...Array(7)].map((_, i) => (
                                        <div key={i} className="animate-pulse">
                                            <div className="flex items-center justify-between">
                                                <div className="h-4 bg-gray-200 rounded w-3/4" />
                                                <div className="h-6 w-11 bg-gray-200 rounded-full" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                notifyConfig?.map((item) => (
                                    <div key={item.name} className="flex items-center justify-between py-2">
                                        <span className="text-sm text-gray-700">
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

export default NotifySetting;
