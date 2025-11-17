import { useEffect } from 'react';
import { notification } from '@baejino/ui';
import { Button } from '~/components/shared';
import { markNotificationAsRead, type NotifyItem } from '~/lib/api/settings';

interface NotificationsSectionProps {
    notifyList: NotifyItem[];
    isLoading: boolean;
    isError: boolean;
    onOpenConfig: () => void;
}

const NotificationsSection = ({
    notifyList,
    isLoading,
    isError,
    onOpenConfig
}: NotificationsSectionProps) => {
    useEffect(() => {
        if (isError) {
            notification('알림 목록을 불러오는데 실패했습니다.', { type: 'error' });
        }
    }, [isError]);

    const handleClickNotify = async (notify: NotifyItem) => {
        if (!notify.isRead) {
            try {
                await markNotificationAsRead(notify.id);
            } catch {
                // Silently handle error
            }
        }
        window.location.href = notify.url;
    };

    return (
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
                    onClick={onOpenConfig}>
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
            {isLoading ? null : (
                <div className="space-y-3">
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
                            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mb-4">
                                <i className="fas fa-bell text-gray-400 text-2xl" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-1">알림이 없습니다</h3>
                            <p className="text-gray-500 text-sm">새로운 알림이 도착하면 여기에 표시됩니다.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationsSection;
