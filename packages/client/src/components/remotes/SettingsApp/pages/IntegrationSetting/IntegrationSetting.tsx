import { useState, useEffect } from 'react';
import { useLingui } from '@lingui/react/macro';
import { toast } from '~/utils/toast';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Navigate } from '@tanstack/react-router';
import {
    Check,
    CirclePause,
    Plug,
    Unlink
} from '~/ui/icons';
import { SettingsHeader } from '../../components';
import { Button, Card } from '~/components/shared';
import { useConfirm } from '~/hooks/useConfirm';
import {
    getTelegramStatus,
    disconnectTelegram as disconnectTelegramAPI,
    TELEGRAM_CONNECT_LINK_QUERY_KEY
} from '~/lib/api/telegram';
import TelegramConnectCard from './components/TelegramConnectCard';

const IntegrationSettings = () => {
    const { t } = useLingui();
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const { confirm } = useConfirm();
    const queryClient = useQueryClient();

    const { data: telegramData, refetch } = useSuspenseQuery({
        queryKey: ['telegram-integration'],
        queryFn: async () => {
            const { data } = await getTelegramStatus();
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error(data.errorMessage || t({
                id: 'settings.telegram.load_failed',
                message: 'Could not load Telegram integration details.'
            }));
        }
    });

    const isConnected = telegramData?.isConnected === true;
    const isConfigured = telegramData?.isConfigured === true;
    const botUsername = telegramData?.botUsername ?? '';

    const disconnectTelegram = async () => {
        const confirmed = await confirm({
            title: t({
                id: 'settings.telegram.disconnect.title',
                message: 'Disconnect Telegram'
            }),
            message: t({
                id: 'settings.telegram.disconnect.message',
                message: 'Disconnect your Telegram account?'
            }),
            confirmText: t({
                id: 'settings.telegram.disconnect.action',
                message: 'Disconnect'
            }),
            variant: 'danger'
        });

        if (!confirmed) return;

        setIsDisconnecting(true);
        try {
            const { data } = await disconnectTelegramAPI();
            if (data.status === 'DONE') {
                toast.success(t({
                    id: 'settings.telegram.disconnect.success',
                    message: 'Telegram disconnected.'
                }));
                // The cached link carried the code that was just used, so issue a new one.
                queryClient.removeQueries({ queryKey: TELEGRAM_CONNECT_LINK_QUERY_KEY });
                refetch();
            } else if (data.errorCode === 'ALREADY_DISCONNECTED') {
                toast.info(t({
                    id: 'settings.telegram.disconnect.already',
                    message: 'Telegram is already disconnected.'
                }));
                refetch();
            } else {
                toast.error(data.errorMessage || t({
                    id: 'settings.telegram.disconnect.failed',
                    message: 'Could not disconnect Telegram.'
                }));
            }
        } catch {
            toast.error(t({
                id: 'common.network_error',
                message: 'A network error occurred.'
            }));
        } finally {
            setIsDisconnecting(false);
        }
    };

    // Poll only while waiting for the connection.
    useEffect(() => {
        if (!isConnected) {
            const interval = setInterval(() => {
                refetch();
            }, 5000);
            return () => clearInterval(interval);
        }
    }, [isConnected, refetch]);

    return (
        <div className="space-y-8">
            <SettingsHeader
                title={t({
                    id: 'settings.telegram.title',
                    message: 'Telegram integration'
                })}
                description={t({
                    id: 'settings.telegram.description',
                    message: 'Connect the Telegram bot to receive notifications in real time.'
                })}
            />

            {isConnected ? (
                <Card
                    title={t({
                        id: 'settings.telegram.status.title',
                        message: 'Connection status'
                    })}
                    icon={<Plug aria-hidden className="h-4 w-4" />}>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex items-center gap-4 flex-1">
                            <div className={`flex items-center justify-center w-12 h-12 rounded-xl flex-shrink-0 ${isConfigured ? 'bg-action' : 'bg-warning-surface'}`}>
                                {isConfigured
                                    ? <Check aria-hidden className="h-4 w-4 text-content-inverted" />
                                    : <CirclePause aria-hidden className="h-4 w-4 text-warning" />}
                            </div>
                            <div>
                                <h4 className="text-base font-semibold text-content">
                                    {isConfigured
                                        ? t({
                                            id: 'settings.telegram.status.connected',
                                            message: 'Connected'
                                        })
                                        : t({
                                            id: 'settings.telegram.status.paused',
                                            message: 'Notifications paused'
                                        })}
                                </h4>
                                <p className="text-sm text-content-secondary mt-1">
                                    {isConfigured
                                        ? t({
                                            id: 'settings.telegram.status.connected_description',
                                            message: 'You can receive real-time notifications in Telegram.'
                                        })
                                        : t({
                                            id: 'settings.telegram.status.paused_description',
                                            message: 'Telegram notification delivery is currently paused.'
                                        })}
                                </p>
                            </div>
                        </div>
                        <Button
                            density="compact"
                            variant="danger"
                            size="md"
                            isLoading={isDisconnecting}
                            leftIcon={!isDisconnecting ? <Unlink aria-hidden className="h-4 w-4" /> : undefined}
                            onClick={disconnectTelegram}
                            className="flex-shrink-0">
                            {isDisconnecting
                                ? t({
                                    id: 'settings.telegram.disconnect.disconnecting',
                                    message: 'Disconnecting...'
                                })
                                : t({
                                    id: 'settings.telegram.disconnect.action',
                                    message: 'Disconnect'
                                })}
                        </Button>
                    </div>
                </Card>
            ) : !isConfigured ? (
                <Navigate to="/notify" replace />
            ) : (
                <TelegramConnectCard botUsername={botUsername} />
            )}
        </div>
    );
};

export default IntegrationSettings;
