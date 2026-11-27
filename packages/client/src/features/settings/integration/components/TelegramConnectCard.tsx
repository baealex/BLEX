import { Trans, useLingui } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { Link, Loader2, Send } from '~/ui/icons';
import { Alert, Button, Card, INTERACTION_DURATION } from '~/components/shared';
import { generateTelegramToken, TELEGRAM_CONNECT_LINK_QUERY_KEY } from '~/lib/api/telegram';

// Reuse the link while the user moves between settings pages and Telegram, without restoring it after a reload.
const CONNECT_LINK_REUSE_MS = 30 * 60 * 1000;

interface TelegramConnectCardProps {
    botUsername: string;
}

const TelegramConnectCard = ({ botUsername }: TelegramConnectCardProps) => {
    const { t } = useLingui();

    // Each request issues a new code and invalidates the previous one, so never refetch in the background
    // while the user is switching to Telegram, and never restore a used or expired code from sessionStorage.
    const connectLinkQuery = useQuery({
        queryKey: TELEGRAM_CONNECT_LINK_QUERY_KEY,
        queryFn: async () => {
            const generateErrorMessage = t({
                id: 'settings.telegram.token.generate_error',
                message: 'An error occurred while generating the verification code.'
            });
            const response = await generateTelegramToken().catch(() => {
                throw new Error(generateErrorMessage);
            });
            if (response.data.status !== 'DONE') {
                throw new Error(
                    response.data.errorMessage ||
                        t({
                            id: 'settings.telegram.token.generate_failed',
                            message: 'Could not generate a verification code.'
                        })
                );
            }
            return response.data.body;
        },
        staleTime: CONNECT_LINK_REUSE_MS,
        gcTime: CONNECT_LINK_REUSE_MS,
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        meta: { persist: false }
    });
    const connectLink = connectLinkQuery.data;

    return (
        <Card
            title={t({
                id: 'settings.telegram.instructions.title',
                message: 'How to connect'
            })}
            icon={<Link aria-hidden className="h-4 w-4" />}
        >
            <div className="space-y-5">
                <p className="text-sm leading-relaxed text-content">
                    <Trans id="settings.telegram.connect.description">
                        Open Telegram and tap Start in the chat with the bot. This page updates on its own once you are
                        connected.
                    </Trans>
                </p>

                {connectLink ? (
                    <>
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                            <img
                                src={connectLink.qrCode}
                                alt={t({
                                    id: 'settings.telegram.connect.qr_alt',
                                    message: 'QR code that opens the Telegram bot'
                                })}
                                className="hidden h-36 w-36 shrink-0 rounded-lg border border-line sm:block"
                            />
                            <div className="space-y-2">
                                <a
                                    href={connectLink.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-transparent bg-action px-4.5 py-2 text-sm font-semibold text-content-inverted transition-all ${INTERACTION_DURATION} hover:bg-action-hover active:scale-95 sm:w-auto [@media(pointer:fine)]:min-h-[40px]`}
                                >
                                    <Send aria-hidden className="h-4 w-4" />
                                    <Trans id="settings.telegram.connect.open">Connect in Telegram</Trans>
                                </a>
                                <p className="hidden text-xs leading-relaxed text-content-secondary sm:block">
                                    <Trans id="settings.telegram.connect.qr_hint">
                                        To connect on your phone, scan the QR code with its camera.
                                    </Trans>
                                </p>
                            </div>
                        </div>

                        <div className="rounded-xl border border-line bg-surface-subtle p-4 text-sm leading-relaxed text-content-secondary">
                            <p>
                                <Trans id="settings.telegram.connect.manual">
                                    If the button does not open Telegram, send this code to{' '}
                                    <a
                                        href={`https://t.me/${botUsername}`}
                                        className="font-medium text-content underline decoration-1 underline-offset-2"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        @{botUsername}
                                    </a>
                                    . The code can be used for 24 hours.
                                </Trans>
                            </p>
                            <div className="mt-3 flex items-center gap-3">
                                <code className="font-mono text-base font-semibold tracking-wide text-content">
                                    {connectLink.token}
                                </code>
                                <Button
                                    density="compact"
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => navigator.clipboard?.writeText(connectLink.token)}
                                >
                                    <Trans id="common.copy">Copy</Trans>
                                </Button>
                            </div>
                        </div>
                    </>
                ) : connectLinkQuery.isError ? (
                    <Alert variant="error">
                        <p>{connectLinkQuery.error.message}</p>
                        <Button
                            density="compact"
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="mt-3"
                            isLoading={connectLinkQuery.isFetching}
                            onClick={() => void connectLinkQuery.refetch()}
                        >
                            <Trans id="settings.telegram.connect.retry">Try again</Trans>
                        </Button>
                    </Alert>
                ) : (
                    <p className="flex items-center gap-2 text-sm text-content-secondary">
                        <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                        <Trans id="settings.telegram.connect.preparing">Preparing your connection link...</Trans>
                    </p>
                )}
            </div>
        </Card>
    );
};

export default TelegramConnectCard;
