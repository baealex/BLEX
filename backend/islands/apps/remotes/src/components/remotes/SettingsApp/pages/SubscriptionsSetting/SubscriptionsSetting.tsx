import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { BellRing, Send } from '@blex/ui/icons';
import { Button } from '~/components/shared';
import { toast } from '~/utils/toast';
import { SETTINGS_LIST_META, SETTINGS_LIST_TITLE } from '~/styles/settingsStyles';
import { formatDateOnly } from '~/i18n/formatters';
import { normalizeLocale } from '~/i18n/locale';
import {
    SettingsEmptyState,
    SettingsHeader,
    SettingsListItem
} from '../../components';
import {
    getAuthorSubscriptions,
    unsubscribeAuthor,
    type AuthorSubscription
} from '~/lib/api/settings';

interface SettingsRouterContext {
    canUseTelegramIntegration: boolean;
}

const SubscriptionsSetting = () => {
    const { t, i18n } = useLingui();
    const router = useRouter();
    const { canUseTelegramIntegration } = router.options.context as SettingsRouterContext;
    const [pendingUsername, setPendingUsername] = useState<string | null>(null);

    const { data, refetch } = useSuspenseQuery({
        queryKey: ['author-subscriptions'],
        queryFn: async () => {
            const { data } = await getAuthorSubscriptions();
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error(data.errorMessage || t({
                id: 'settings.subscriptions.load_failed',
                message: 'Could not load your subscriptions.'
            }));
        }
    });

    const subscriptions = data.subscriptions ?? [];
    const showTelegramPrompt = canUseTelegramIntegration && !data.isTelegramConnected;

    const handleUnsubscribe = async (subscription: AuthorSubscription) => {
        const failedMessage = t({
            id: 'settings.subscriptions.unsubscribe_failed',
            message: 'Could not unsubscribe. Please try again.'
        });

        setPendingUsername(subscription.username);
        try {
            const { data } = await unsubscribeAuthor(subscription.username);
            if (data.status === 'DONE') {
                toast.success(i18n._({
                    id: 'settings.subscriptions.unsubscribed',
                    message: 'Unsubscribed from {username}.',
                    values: { username: subscription.username }
                }));
                await refetch();
            } else {
                toast.error(data.errorMessage || failedMessage);
            }
        } catch {
            toast.error(failedMessage);
        } finally {
            setPendingUsername(null);
        }
    };

    return (
        <div className="space-y-8">
            <SettingsHeader
                title={t({
                    id: 'settings.subscriptions.title',
                    message: 'Subscriptions'
                })}
                description={t({
                    id: 'settings.subscriptions.description',
                    message: 'Get notified when authors you subscribe to publish new posts.'
                })}
            />

            {showTelegramPrompt && (
                <a
                    href="/settings/integration"
                    className="group relative block overflow-hidden rounded-2xl bg-surface ring-1 ring-line/60 transition-all duration-200 hover:ring-line">
                    <div className="relative flex items-center justify-between p-5 sm:p-6">
                        <div>
                            <h3 className="mb-1.5 text-base font-semibold text-content">
                                <Trans id="settings.subscriptions.telegram.title">
                                    Get new posts on Telegram
                                </Trans>
                            </h3>
                            <p className="max-w-xl text-sm leading-relaxed text-content-secondary">
                                <Trans id="settings.subscriptions.telegram.description">
                                    Connect Telegram to get new post notifications there too.
                                </Trans>
                            </p>
                        </div>
                        <div className="ml-6 flex-shrink-0">
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-surface-subtle text-content-secondary transition-colors motion-interaction group-hover:bg-action group-hover:text-content-inverted">
                                <Send aria-hidden="true" className="h-5 w-5" />
                            </span>
                        </div>
                    </div>
                </a>
            )}

            {subscriptions.length > 0 ? (
                <div className="space-y-3">
                    {subscriptions.map((subscription) => {
                        const subscribedDate = formatDateOnly(
                            subscription.subscribedDate,
                            normalizeLocale(i18n.locale),
                            subscription.subscribedDate
                        );

                        return (
                            <SettingsListItem
                                key={subscription.username}
                                left={
                                    <img
                                        src={subscription.avatar}
                                        alt=""
                                        loading="lazy"
                                        className="h-10 w-10 flex-shrink-0 rounded-full object-cover ring-1 ring-line/60"
                                    />
                                }
                                actions={
                                    <Button
                                        density="compact"
                                        variant="secondary"
                                        size="sm"
                                        className="min-h-11! [@media(pointer:fine)]:min-h-9!"
                                        isLoading={pendingUsername === subscription.username}
                                        disabled={pendingUsername !== null}
                                        onClick={() => handleUnsubscribe(subscription)}>
                                        <Trans id="settings.subscriptions.unsubscribe">Unsubscribe</Trans>
                                    </Button>
                                }>
                                <a
                                    href={`/@${encodeURIComponent(subscription.username)}`}
                                    className={`${SETTINGS_LIST_TITLE} mb-0.5 block truncate hover:text-content-secondary transition-colors`}>
                                    {subscription.name || subscription.username}
                                </a>
                                <div className={`${SETTINGS_LIST_META} flex flex-wrap items-center gap-x-3 gap-y-1`}>
                                    <span>@{subscription.username}</span>
                                    <span>
                                        {i18n._({
                                            id: 'settings.subscriptions.subscribed_since',
                                            message: 'Subscribed on {date}',
                                            values: { date: subscribedDate }
                                        })}
                                    </span>
                                    {!subscription.isPublishing && (
                                        <span className="text-content-hint">
                                            <Trans id="settings.subscriptions.not_publishing">
                                                No longer publishing
                                            </Trans>
                                        </span>
                                    )}
                                </div>
                            </SettingsListItem>
                        );
                    })}
                </div>
            ) : (
                <SettingsEmptyState
                    icon={<BellRing aria-hidden="true" className="h-4 w-4" />}
                    title={t({
                        id: 'settings.subscriptions.empty.title',
                        message: 'No subscriptions yet'
                    })}
                    description={t({
                        id: 'settings.subscriptions.empty.description',
                        message: 'Subscribe from an author page or below a post to hear about new posts.'
                    })}
                />
            )}
        </div>
    );
};

export default SubscriptionsSetting;
