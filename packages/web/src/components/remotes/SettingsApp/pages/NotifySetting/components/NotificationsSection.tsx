import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import {
    BellOff,
    ChevronRight,
    Clock,
    Send,
    Settings2
} from '@blex/ui/icons';
import { Button } from '~/components/shared';
import { toast } from '~/utils/toast';
import { SETTINGS_LIST_TITLE } from '~/styles/settingsStyles';
import {
    SettingsEmptyState,
    SettingsHeader,
    SettingsHeaderAction,
    SettingsListItem
} from '../../../components';
import { markNotificationAsRead, type NotifyItem } from '~/lib/api/settings';
import { getSafeNotificationNavigationUrl } from '../notificationNavigation';

interface NotificationsSectionProps {
    notifyList: NotifyItem[];
    showTelegramIntegration: boolean;
    onOpenConfig: () => void;
}

const NotificationsSection = ({
    notifyList,
    showTelegramIntegration,
    onOpenConfig
}: NotificationsSectionProps) => {
    const { t } = useLingui();
    const [locallyReadNotificationIds, setLocallyReadNotificationIds] = useState<Set<number>>(
        () => new Set()
    );
    const [markingReadNotificationId, setMarkingReadNotificationId] = useState<number | null>(null);

    const isNotificationRead = (notify: NotifyItem) => {
        return notify.isRead || locallyReadNotificationIds.has(notify.id);
    };

    const markAsRead = async (notify: NotifyItem) => {
        if (isNotificationRead(notify)) return;

        setMarkingReadNotificationId(notify.id);
        try {
            const { data } = await markNotificationAsRead(notify.id);
            if (data.status === 'DONE') {
                setLocallyReadNotificationIds((notificationIds) => {
                    const nextNotificationIds = new Set(notificationIds);
                    nextNotificationIds.add(notify.id);
                    return nextNotificationIds;
                });
                window.dispatchEvent(new CustomEvent(
                    'blex:notification-read',
                    { detail: { notificationId: notify.id } }
                ));
            } else {
                toast.error(data.errorMessage || t({
                    id: 'settings.notifications.mark_read_failed',
                    message: 'Could not mark the notification as read.'
                }));
            }
        } catch {
            toast.error(t({
                id: 'settings.notifications.mark_read_failed',
                message: 'Could not mark the notification as read.'
            }));
        } finally {
            setMarkingReadNotificationId(null);
        }
    };

    const handleClickNotify = async (notify: NotifyItem, targetUrl: string) => {
        await markAsRead(notify);
        window.location.assign(targetUrl);
    };

    return (
        <div className="space-y-8">
            <SettingsHeader
                title={t({
                    id: 'settings.notifications.title',
                    message: 'Notifications'
                })}
                actionPosition="right"
                action={
                    <SettingsHeaderAction
                        variant="secondary"
                        leftIcon={<Settings2 aria-hidden="true" className="h-4 w-4" />}
                        onClick={onOpenConfig}>
                        <Trans id="settings.notifications.configure">Settings</Trans>
                    </SettingsHeaderAction>
                }
            />

            {showTelegramIntegration && (
                <a
                    href="/settings/integration"
                    className="group relative block overflow-hidden rounded-2xl bg-surface ring-1 ring-line/60 transition-all duration-200 hover:ring-line">
                    <div className="relative p-5 sm:p-6 flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-semibold text-content mb-1.5">
                                <Trans id="settings.notifications.telegram.title">
                                    Connect Telegram
                                </Trans>
                            </h3>
                            <p className="text-content-secondary text-sm max-w-xl leading-relaxed">
                                <Trans id="settings.notifications.telegram.description">
                                    Connect Telegram to receive notifications about new posts, comments, and follows.
                                </Trans>
                            </p>
                        </div>
                        <div className="flex-shrink-0 ml-6">
                            <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-surface-subtle text-content-secondary group-hover:bg-action group-hover:text-content-inverted transition-colors motion-interaction">
                                <Send aria-hidden="true" className="h-5 w-5" />
                            </span>
                        </div>
                    </div>
                </a>
            )}

            {/* Notification list */}
            <div className="space-y-3">
                {notifyList.length > 0 ? (
                    notifyList.map((item) => {
                        const targetUrl = getSafeNotificationNavigationUrl(
                            item.url,
                            window.location.href
                        );
                        const isRead = isNotificationRead(item);

                        return (
                            <SettingsListItem
                                key={item.id}
                                className="items-start"
                                onClick={targetUrl
                                    ? () => handleClickNotify(item, targetUrl)
                                    : undefined}
                                actions={
                                    <div className="flex-shrink-0 self-center text-content-hint">
                                        {targetUrl ? (
                                            <ChevronRight aria-hidden="true" className="h-4 w-4" />
                                        ) : !isRead ? (
                                            <Button
                                                density="compact"
                                                variant="ghost"
                                                size="sm"
                                                className="min-h-11! [@media(pointer:fine)]:min-h-9!"
                                                isLoading={markingReadNotificationId === item.id}
                                                onClick={() => markAsRead(item)}>
                                                <Trans id="settings.notifications.mark_read">
                                                    Mark as read
                                                </Trans>
                                            </Button>
                                        ) : (
                                            <span className="text-xs">
                                                <Trans id="settings.notifications.link_unavailable">
                                                    Link unavailable
                                                </Trans>
                                            </span>
                                        )}
                                    </div>
                                }>
                                <div className={`${SETTINGS_LIST_TITLE} ${!isRead ? 'font-semibold text-content' : 'font-medium text-content-secondary'} mb-1.5 leading-relaxed`}>
                                    {item.content}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-content-hint">
                                    <Clock aria-hidden="true" className="h-3.5 w-3.5" />
                                    <span>{item.createdDate}</span>
                                    {!isRead && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-danger-surface text-danger border border-danger-line">
                                            <Trans id="settings.notifications.new">New</Trans>
                                        </span>
                                    )}
                                </div>
                            </SettingsListItem>
                        );
                    })
                ) : (
                    <SettingsEmptyState
                        icon={<BellOff aria-hidden="true" className="h-5 w-5" />}
                        title={t({
                            id: 'settings.notifications.empty',
                            message: 'No notifications'
                        })}
                    />
                )}
            </div>
        </div>
    );
};

export default NotificationsSection;
