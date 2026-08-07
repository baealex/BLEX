import { useState, useEffect } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { toast } from '~/utils/toast';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Navigate } from '@tanstack/react-router';
import {
    Check,
    CirclePause,
    ExternalLink,
    Link,
    Plug,
    Unlink
} from '@blex/ui/icons';
import { SettingsHeader } from '../../components';
import { Button, Card } from '~/components/shared';
import { useConfirm } from '~/hooks/useConfirm';
import { getTelegramStatus, generateTelegramToken, disconnectTelegram as disconnectTelegramAPI } from '~/lib/api/telegram';

const IntegrationSettings = () => {
    const { t } = useLingui();
    const [telegramToken, setTelegramToken] = useState('');
    const [isGeneratingToken, setIsGeneratingToken] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const { confirm } = useConfirm();

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

    const refreshToken = async () => {
        if (isGeneratingToken) return;

        setIsGeneratingToken(true);
        try {
            const { data } = await generateTelegramToken();
            if (data.status === 'DONE' && data.body.token) {
                setTelegramToken(data.body.token);
            } else {
                toast.error(
                    (data.status === 'ERROR' && data.errorMessage)
                    || t({
                        id: 'settings.telegram.token.generate_failed',
                        message: 'Could not generate a verification code.'
                    })
                );
            }
        } catch {
            toast.error(t({
                id: 'settings.telegram.token.generate_error',
                message: 'An error occurred while generating the verification code.'
            }));
        } finally {
            setIsGeneratingToken(false);
        }
    };

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
                setTelegramToken('');
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

    // Clear one-time tokens after the connection succeeds.
    useEffect(() => {
        if (isConnected) {
            setTelegramToken('');
        }
    }, [isConnected]);

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
                <Card
                    title={t({
                        id: 'settings.telegram.instructions.title',
                        message: 'How to connect'
                    })}
                    icon={<Link aria-hidden className="h-4 w-4" />}>
                    <div className="space-y-6">
                        <div className="flex items-start gap-3">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-surface-subtle text-content text-sm font-semibold flex-shrink-0">
                                1
                            </span>
                            <p className="text-sm text-content leading-relaxed">
                                <Trans id="settings.telegram.instructions.find_bot">
                                    In Telegram, find{' '}
                                    <a
                                        href={`https://t.me/${botUsername}`}
                                        className="inline-flex items-center text-content hover:text-content font-medium underline decoration-1 underline-offset-2"
                                        target="_blank"
                                        rel="noopener noreferrer">
                                        @{botUsername}
                                        <ExternalLink aria-hidden className="ml-1 h-3.5 w-3.5" />
                                    </a>
                                    {' '}and start a chat.
                                </Trans>
                            </p>
                        </div>

                        <div className="flex items-start gap-3">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-surface-subtle text-content text-sm font-semibold flex-shrink-0">
                                2
                            </span>
                            <div className="flex-1 space-y-3">
                                <p className="text-sm text-content">
                                    <Trans id="settings.telegram.instructions.send_code">
                                        Send the verification code below to the bot.
                                    </Trans>
                                </p>
                                {telegramToken ? (
                                    <div className="rounded-xl border border-line bg-surface-subtle p-4">
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                            <code className="font-mono text-sm sm:text-base font-semibold tracking-wide text-content break-all flex-1">
                                                {telegramToken}
                                            </code>
                                            <Button
                                                density="compact"
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => navigator.clipboard?.writeText(telegramToken)}>
                                                <Trans id="common.copy">Copy</Trans>
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-dashed border-line bg-surface-subtle p-4">
                                        <Button
                                            density="compact"
                                            variant="primary"
                                            size="md"
                                            isLoading={isGeneratingToken}
                                            onClick={refreshToken}>
                                            {isGeneratingToken
                                                ? t({
                                                    id: 'settings.telegram.token.generating',
                                                    message: 'Generating...'
                                                })
                                                : t({
                                                    id: 'settings.telegram.token.generate',
                                                    message: 'Generate verification code'
                                                })}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {telegramToken && (
                            <div className="rounded-xl border border-line bg-surface-subtle p-4 text-sm text-content leading-relaxed">
                                <Trans id="settings.telegram.token.expiration">
                                    This one-time code expires after you connect or after 24 hours. Refresh the page after connecting.
                                </Trans>
                            </div>
                        )}
                    </div>
                </Card>
            )}
        </div>
    );
};

export default IntegrationSettings;
