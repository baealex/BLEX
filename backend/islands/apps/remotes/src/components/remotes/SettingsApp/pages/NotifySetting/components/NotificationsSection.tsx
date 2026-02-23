import {
    Button,
    TITLE
} from '~/components/shared';
import { SettingsEmptyState, SettingsHeader, SettingsListItem } from '../../../components';
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
        window.location.assign(notify.url);
    };

    return (
        <div className="space-y-8">
            <SettingsHeader
                title="알림"
                description="최신 알림을 확인할 수 있습니다."
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
                className="group relative block overflow-hidden rounded-2xl bg-surface ring-1 ring-line/60 transition-all duration-200 hover:ring-line">
                <div className="relative p-5 sm:p-6 flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-semibold text-content mb-1.5">텔레그램 연동</h3>
                        <p className="text-content-secondary text-sm max-w-xl leading-relaxed">
                            텔레그램을 연동하면 새 글 작성, 댓글, 등의 알림을 실시간으로 받아보실 수 있습니다.
                        </p>
                    </div>
                    <div className="flex-shrink-0 ml-6">
                        <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-surface-subtle text-content-secondary group-hover:bg-action group-hover:text-content-inverted transition-colors motion-interaction">
                            <i className="fab fa-telegram-plane text-lg" />
                        </span>
                    </div>
                </div>
            </a>

            {/* Notification list */}
            <div className="space-y-3">
                {notifyList.length > 0 ? (
                    notifyList.map((item) => (
                        <SettingsListItem
                            key={item.id}
                            className="items-start"
                            onClick={() => handleClickNotify(item)}
                            actions={
                                <div className="flex-shrink-0 self-center text-content-hint">
                                    <i className="fas fa-chevron-right" />
                                </div>
                            }>
                            <div className={`${TITLE} ${!item.isRead ? 'font-semibold text-content' : 'font-medium text-content-secondary'} mb-1.5 leading-relaxed`}>
                                {item.content}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-content-hint">
                                <i className="far fa-clock" />
                                <span>{item.createdDate}</span>
                                {!item.isRead && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-danger-surface text-danger border border-danger-line">
                                        NEW
                                    </span>
                                )}
                            </div>
                        </SettingsListItem>
                    ))
                ) : (
                    <SettingsEmptyState
                        iconClassName="fas fa-bell-slash"
                        title="알림이 없습니다"
                        description="새로운 알림이 도착하면 여기에 표시됩니다."
                    />
                )}
            </div>
        </div>
    );
};

export default NotificationsSection;
