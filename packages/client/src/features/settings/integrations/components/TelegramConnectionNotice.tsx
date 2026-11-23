import { useLingui } from '@lingui/react/macro';
import { Alert, Button } from '~/components/shared';
import type { IntegrationSettingData } from '~/lib/api/settings';

interface TelegramConnectionNoticeProps {
    connection: IntegrationSettingData['telegramConnection'];
    botUsername: string;
    isReconnecting: boolean;
    canReconnect: boolean;
    onReconnect: () => void;
}

const TelegramConnectionNotice = ({
    connection,
    botUsername,
    isReconnecting,
    canReconnect,
    onReconnect
}: TelegramConnectionNoticeProps) => {
    const { i18n, t } = useLingui();

    if (connection.state === 'disabled') {
        return null;
    }

    if (connection.state === 'connected') {
        return (
            <Alert
                variant="success"
                title={i18n._({
                    id: 'settings.admin.telegram.connection.connected.title',
                    message: 'Connected to @{botUsername}',
                    values: { botUsername }
                })}>
                {t({
                    id: 'settings.admin.telegram.connection.connected.description',
                    message: 'Users can connect Telegram from their notification settings with a single tap.'
                })}
            </Alert>
        );
    }

    if (connection.state === 'invalid_token') {
        return (
            <Alert
                variant="error"
                title={t({
                    id: 'settings.admin.telegram.connection.invalid_token.title',
                    message: 'The bot token is no longer valid'
                })}>
                {t({
                    id: 'settings.admin.telegram.connection.invalid_token.description',
                    message: 'Get the bot token from BotFather again and save it here.'
                })}
            </Alert>
        );
    }

    const notice = {
        not_connected: {
            variant: 'warning' as const,
            title: t({
                id: 'settings.admin.telegram.connection.not_connected.title',
                message: 'Telegram is not sending messages to BLEX'
            }),
            description: t({
                id: 'settings.admin.telegram.connection.not_connected.description',
                message: 'Reconnect so BLEX can receive the messages users send to the bot.'
            })
        },
        rejected: {
            variant: 'error' as const,
            title: t({
                id: 'settings.admin.telegram.connection.rejected.title',
                message: 'Telegram refused the connection'
            }),
            description: t({
                id: 'settings.admin.telegram.connection.rejected.description',
                message: 'Telegram only delivers messages to a public HTTPS address. Check that SITE_URL is the public HTTPS address of this site, then reconnect.'
            })
        },
        delivery_failed: {
            variant: 'error' as const,
            title: t({
                id: 'settings.admin.telegram.connection.delivery_failed.title',
                message: 'Telegram could not deliver messages to BLEX'
            }),
            description: t({
                id: 'settings.admin.telegram.connection.delivery_failed.description',
                message: 'Reconnect to register this site with Telegram again. This is needed after SECRET_KEY changes or when the bot was connected outside BLEX.'
            })
        },
        unreachable: {
            variant: 'warning' as const,
            title: t({
                id: 'settings.admin.telegram.connection.unreachable.title',
                message: 'Could not reach Telegram'
            }),
            description: t({
                id: 'settings.admin.telegram.connection.unreachable.description',
                message: 'This server could not reach api.telegram.org. Check the server network, then reconnect.'
            })
        }
    }[connection.state];

    return (
        <Alert variant={notice.variant} title={notice.title}>
            <p>{notice.description}</p>
            {connection.detail && (
                <p className="mt-2 break-words font-mono text-xs text-content-secondary">
                    {connection.detail}
                </p>
            )}
            <Button
                density="compact"
                type="button"
                variant="secondary"
                size="sm"
                className="mt-3"
                isLoading={isReconnecting}
                disabled={!canReconnect}
                onClick={onReconnect}>
                {t({
                    id: 'settings.admin.telegram.connection.reconnect',
                    message: 'Reconnect'
                })}
            </Button>
        </Alert>
    );
};

export default TelegramConnectionNotice;
