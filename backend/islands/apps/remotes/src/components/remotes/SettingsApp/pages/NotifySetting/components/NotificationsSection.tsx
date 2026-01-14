import {
    Button,
    getCardClass,
    CARD_PADDING,
    FLEX_ROW,
    TITLE
} from '~/components/shared';
import { SettingsHeader } from '../../../components';
import { markNotificationAsRead, type NotifyItem } from '~/lib/api/settings';

interface NotificationsSectionProps {
    notifyList: NotifyItem[];
    onOpenConfig: () => void;
}

const NotificationsSection = ({
    notifyList,
    onOpenConfig
}: NotificationsSectionProps) => {

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
        <div className="space-y-8">
            <SettingsHeader
                title="알림"
                description="주요 알림을 확인할 수 있습니다."
                actionPosition="right"
                action={
                    <Button
                        variant="secondary"
                        size="md"
                        leftIcon={<i className="fas fa-cog" />}
                        onClick={onOpenConfig}>
                        설정
                    </Button>
                }
            />

            {/* Telegram Integration Card */}
            <a
                href="/settings/integration"
                className="group relative block overflow-hidden rounded-2xl bg-white border border-gray-100 transition-all duration-200 hover:shadow-sm hover:border-gray-200">
                <div className="relative p-5 sm:p-6 flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-semibold text-gray-900 mb-1.5">텔레그램 연동</h3>
                        <p className="text-gray-500 text-sm max-w-xl leading-relaxed">
                            텔레그램을 연동하면 새 글 작성, 댓글, 등의 알림을 실시간으로 받아보실 수 있습니다.
                        </p>
                    </div>
                    <div className="flex-shrink-0 ml-6">
                        <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors duration-200">
                            <i className="fab fa-telegram-plane text-lg" />
                        </span>
                    </div>
                </div>
            </a>

            {/* Notification list */}
            <div className="space-y-3">
                {notifyList.length > 0 ? (
                    notifyList.slice(0, 10).map((item) => (
                        <div
                            key={item.id}
                            className={getCardClass('cursor-pointer')}
                            onClick={() => handleClickNotify(item)}>
                            <div className={CARD_PADDING}>
                                <div className={`${FLEX_ROW} items-start`}>
                                    <div className="flex-1 min-w-0">
                                        <div className={`${TITLE} ${!item.isRead ? 'font-semibold' : 'font-medium! text-gray-600!'} mb-1.5 leading-relaxed`}>
                                            {item.content}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-gray-400">
                                            <i className="far fa-clock" />
                                            <span>{item.createdDate}</span>
                                            {!item.isRead && (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-600 border border-red-100">
                                                    NEW
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0 self-center text-gray-300 ml-3">
                                        <i className="fas fa-chevron-right" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 border-dashed">
                        <div className="w-12 h-12 mx-auto bg-gray-50 rounded-xl flex items-center justify-center mb-4 text-gray-300">
                            <i className="fas fa-bell-slash text-xl" />
                        </div>
                        <h3 className="text-base font-semibold text-gray-900 mb-1">알림이 없습니다</h3>
                        <p className="text-gray-400 text-sm">새로운 알림이 도착하면 여기에 표시됩니다.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationsSection;
