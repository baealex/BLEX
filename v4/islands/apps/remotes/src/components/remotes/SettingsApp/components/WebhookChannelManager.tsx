import { useMemo, useState } from 'react';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import type { AxiosResponse } from 'axios';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
    AlertTriangle,
    CheckCircle,
    Clock,
    Code2,
    Info,
    Link as LinkIcon,
    Trash2,
    Zap
} from '@blex/ui/icons';
import type { LucideIcon } from '@blex/ui/icons';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from '~/utils/toast';
import { useConfirm } from '~/hooks/useConfirm';
import { Button, Dropdown, Input } from '~/components/shared';
import {
    getSettingsIconClass,
    SETTINGS_LIST_META,
    SETTINGS_LIST_TITLE
} from '~/styles/settingsStyles';
import {
    SettingsEmptyState,
    SettingsHeader,
    SettingsHeaderAction,
    SettingsListItem
} from '.';
import type { WebhookChannel } from '~/lib/api/settings';
import type { Response } from '~/lib/http.module';
import { formatDateTime } from '~/i18n/formatters';
import { normalizeLocale } from '~/i18n/locale';

type ChannelsResponse = Response<{ channels: WebhookChannel[] }>;
type CreateResponse = Response<{ success: boolean; channelId: number }>;
type DeleteResponse = Response<{ success: boolean }>;
type TestResponse = Response<{ success: boolean }>;

interface WebhookProviderInfo {
    title: MessageDescriptor;
    badge: MessageDescriptor;
    description: MessageDescriptor;
    payload: string | MessageDescriptor;
    icon: LucideIcon;
    statusClassName: string;
}

interface WebhookChannelManagerProps {
    queryKey: string[];
    title: string;
    description: string;
    formTitle: string;
    emptyTitle: string;
    emptyDescription?: string;
    addButtonLabel?: string;
    fetchChannels: () => Promise<AxiosResponse<ChannelsResponse>>;
    createChannel: (data: { webhook_url: string; name?: string }) => Promise<AxiosResponse<CreateResponse>>;
    deleteChannel: (channelId: number) => Promise<AxiosResponse<DeleteResponse>>;
    testChannel: (webhookUrl: string) => Promise<AxiosResponse<TestResponse>>;
    confirmDeleteTitle: string;
    confirmDeleteMessage: string;
    addSuccessMessage: string;
    addFailMessage: string;
    deleteSuccessMessage: string;
    deleteFailMessage: string;
}

interface WebhookFormInputs {
    webhookUrl: string;
    webhookName: string;
}

const WEBHOOK_MESSAGE_PREVIEW = msg({
    id: 'settings.webhooks.preview.message',
    message: '[baealex] Published a new post: [BLEX update](https://blex.me/@baealex/blex-update)'
});

const getWebhookProviderInfo = (
    webhookUrl: string,
    messagePreview: string
): WebhookProviderInfo => {
    const normalizedUrl = webhookUrl.trim().toLowerCase();

    if (!normalizedUrl) {
        return {
            title: msg({
                id: 'settings.webhooks.provider.pending.title',
                message: 'Delivery format'
            }),
            badge: msg({
                id: 'settings.webhooks.provider.pending.badge',
                message: 'Waiting for URL'
            }),
            description: msg({
                id: 'settings.webhooks.provider.pending.description',
                message: 'Discord and Slack use their official webhook formats. Other URLs receive generic JSON.'
            }),
            payload: msg({
                id: 'settings.webhooks.provider.pending.payload',
                message: 'Enter a URL to preview the payload format.'
            }),
            icon: Info,
            statusClassName: 'text-content-secondary'
        };
    }

    if (
        normalizedUrl.includes('discord.com/api/webhooks') ||
        normalizedUrl.includes('discordapp.com/api/webhooks')
    ) {
        return {
            title: msg({
                id: 'settings.webhooks.provider.discord.title',
                message: 'Discord Webhook'
            }),
            badge: msg({
                id: 'settings.webhooks.provider.official_badge',
                message: 'Official format'
            }),
            description: msg({
                id: 'settings.webhooks.provider.discord.description',
                message: 'Recognized as a Discord channel webhook URL.'
            }),
            payload: JSON.stringify({ content: messagePreview }, null, 2),
            icon: CheckCircle,
            statusClassName: 'text-success'
        };
    }

    if (normalizedUrl.includes('hooks.slack.com/services')) {
        return {
            title: msg({
                id: 'settings.webhooks.provider.slack.title',
                message: 'Slack Incoming Webhook'
            }),
            badge: msg({
                id: 'settings.webhooks.provider.official_badge',
                message: 'Official format'
            }),
            description: msg({
                id: 'settings.webhooks.provider.slack.description',
                message: 'Recognized as a Slack Incoming Webhook URL.'
            }),
            payload: JSON.stringify({
                text: messagePreview,
                unfurl_links: true
            }, null, 2),
            icon: CheckCircle,
            statusClassName: 'text-success'
        };
    }

    return {
        title: msg({
            id: 'settings.webhooks.provider.generic.title',
            message: 'Generic webhook URL'
        }),
        badge: msg({
            id: 'settings.webhooks.provider.generic.badge',
            message: 'Generic JSON'
        }),
        description: msg({
            id: 'settings.webhooks.provider.generic.description',
            message: 'BLEX sends a JSON POST request to this URL. The receiver must handle the fields below.'
        }),
        payload: JSON.stringify({
            content: messagePreview,
            text: messagePreview,
            message: messagePreview,
            url: 'https://blex.me/@baealex/blex-update'
        }, null, 2),
        icon: Code2,
        statusClassName: 'text-content-secondary'
    };
};

const WebhookChannelManager = ({
    queryKey,
    title,
    description,
    formTitle,
    emptyTitle,
    emptyDescription,
    addButtonLabel,
    fetchChannels,
    createChannel,
    deleteChannel,
    testChannel,
    confirmDeleteTitle,
    confirmDeleteMessage,
    addSuccessMessage,
    addFailMessage,
    deleteSuccessMessage,
    deleteFailMessage
}: WebhookChannelManagerProps) => {
    const { i18n, t } = useLingui();
    const webhookSchema = useMemo(() => z.object({
        webhookUrl: z.string()
            .min(1, t({
                id: 'settings.webhooks.validation.url_required',
                message: 'Enter a webhook URL.'
            }))
            .url(t({
                id: 'settings.webhooks.validation.url_invalid',
                message: 'Enter a valid URL.'
            })),
        webhookName: z.string().max(100, t({
            id: 'settings.webhooks.validation.name_max_length',
            message: 'The display name must be 100 characters or fewer.'
        }))
    }), [t]);
    const { confirm } = useConfirm();
    const [isAdding, setIsAdding] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const {
        register,
        handleSubmit,
        trigger,
        getValues,
        watch,
        reset,
        formState: { errors }
    } = useForm<WebhookFormInputs>({
        resolver: zodResolver(webhookSchema),
        defaultValues: {
            webhookUrl: '',
            webhookName: ''
        }
    });

    const { data: channels, refetch } = useSuspenseQuery({
        queryKey,
        queryFn: async () => {
            const { data } = await fetchChannels();
            if (data.status === 'DONE') {
                return (data.body.channels ?? []) as WebhookChannel[];
            }
            throw new Error(data.errorMessage || t({
                id: 'settings.webhooks.load_failed',
                message: 'Could not load webhook destinations.'
            }));
        }
    });
    const webhookMessagePreview = i18n._(WEBHOOK_MESSAGE_PREVIEW);
    const webhookProvider = getWebhookProviderInfo(
        watch('webhookUrl'),
        webhookMessagePreview
    );
    const webhookPayload = typeof webhookProvider.payload === 'string'
        ? webhookProvider.payload
        : i18n._(webhookProvider.payload);
    const WebhookProviderIcon = webhookProvider.icon;
    const resolvedAddButtonLabel = addButtonLabel || t({
        id: 'settings.webhooks.add_destination',
        message: 'Add destination'
    });

    const handleTest = async () => {
        const isValid = await trigger('webhookUrl');
        if (!isValid) {
            return;
        }

        const webhookUrl = getValues('webhookUrl');

        setIsTesting(true);
        try {
            const { data } = await testChannel(webhookUrl);
            if (data.status === 'DONE') {
                if (data.body?.success) {
                    toast.success(t({
                        id: 'settings.webhooks.test.success',
                        message: 'Test message sent.'
                    }));
                } else {
                    toast.error(t({
                        id: 'settings.webhooks.test.failed',
                        message: 'Webhook test failed. Check the URL and try again.'
                    }));
                }
            } else {
                toast.error(data.errorMessage || t({
                    id: 'settings.webhooks.test.failed',
                    message: 'Webhook test failed. Check the URL and try again.'
                }));
            }
        } catch {
            toast.error(t({
                id: 'settings.webhooks.test.error',
                message: 'An error occurred while testing the webhook.'
            }));
        } finally {
            setIsTesting(false);
        }
    };

    const onSubmit = async ({ webhookUrl, webhookName }: WebhookFormInputs) => {
        setIsAdding(true);
        try {
            const { data } = await createChannel({
                webhook_url: webhookUrl,
                name: webhookName || undefined
            });

            if (data.status === 'DONE') {
                toast.success(addSuccessMessage);
                reset();
                setShowAddForm(false);
                refetch();
            } else {
                toast.error(data.errorMessage || addFailMessage);
            }
        } catch {
            toast.error(addFailMessage);
        } finally {
            setIsAdding(false);
        }
    };

    const handleCancel = () => {
        setShowAddForm(false);
        reset();
    };

    const handleDelete = async (channelId: number) => {
        const confirmed = await confirm({
            title: confirmDeleteTitle,
            message: confirmDeleteMessage,
            confirmText: t({
                id: 'common.delete',
                message: 'Delete'
            }),
            variant: 'danger'
        });

        if (!confirmed) return;

        try {
            const { data } = await deleteChannel(channelId);

            if (data.status === 'DONE') {
                toast.success(deleteSuccessMessage);
                refetch();
            } else {
                throw new Error('Failed to delete webhook channel');
            }
        } catch {
            toast.error(deleteFailMessage);
        }
    };

    const getStatusBadge = (channel: { isActive: boolean; failureCount: number }) => {
        if (!channel.isActive) {
            return (
                <span className="bg-action text-content-inverted px-2 py-0.5 rounded-md text-xs font-medium">
                    <Trans id="settings.webhooks.status.inactive">Inactive</Trans>
                </span>
            );
        }
        if (channel.failureCount > 0) {
            return (
                <span className="bg-line text-content px-2 py-0.5 rounded-md text-xs font-medium">
                    {i18n._({
                        id: 'settings.webhooks.status.failures',
                        message: '{count, plural, one {# failure} other {# failures}}',
                        values: { count: channel.failureCount }
                    })}
                </span>
            );
        }
        return (
            <span className="bg-surface-subtle text-content-secondary px-2 py-0.5 rounded-md text-xs font-medium">
                <Trans id="settings.webhooks.status.active">Active</Trans>
            </span>
        );
    };

    const createAction = (
        <SettingsHeaderAction
            variant="primary"
            onClick={() => {
                reset();
                setShowAddForm(true);
            }}>
            {resolvedAddButtonLabel}
        </SettingsHeaderAction>
    );

    return (
        <div>
            <SettingsHeader
                title={title}
                description={description}
                actionPosition="right"
                action={channels && channels.length > 0 ? createAction : undefined}
            />

            {showAddForm && (
                <form
                    className="mb-6 bg-surface-subtle border border-line rounded-2xl p-6 animate-in fade-in-0 slide-in-from-top-2 motion-interaction"
                    onSubmit={handleSubmit(onSubmit)}>
                    <h3 className="text-base font-semibold text-content mb-4">{formTitle}</h3>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="webhookUrl" className="block text-sm font-medium text-content mb-1">
                                <Trans id="settings.webhooks.form.url">Webhook URL</Trans>{' '}
                                <span className="text-danger">*</span>
                            </label>
                            <Input
                                density="compact"
                                id="webhookUrl"
                                type="url"
                                placeholder="https://example.com/webhook"
                                error={errors.webhookUrl?.message}
                                {...register('webhookUrl')}
                            />
                            <div className="mt-3 border-l border-line pl-3">
                                <div className="flex items-start gap-3">
                                    <WebhookProviderIcon
                                        aria-hidden="true"
                                        className={`mt-0.5 h-4 w-4 shrink-0 ${webhookProvider.statusClassName}`}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-sm font-semibold text-content">
                                                {i18n._(webhookProvider.title)}
                                            </p>
                                            <span className={`text-xs font-semibold ${webhookProvider.statusClassName}`}>
                                                {i18n._(webhookProvider.badge)}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-xs leading-relaxed text-content-secondary">
                                            {i18n._(webhookProvider.description)}
                                        </p>
                                        <div className="mt-3 space-y-2">
                                            <div>
                                                <p className="text-[11px] font-semibold text-content-secondary">
                                                    <Trans id="settings.webhooks.preview.message_label">Message</Trans>
                                                </p>
                                                <p className="mt-1 rounded-md bg-surface px-3 py-2 text-xs leading-relaxed text-content">
                                                    {webhookMessagePreview}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-semibold text-content-secondary">
                                                    <Trans id="settings.webhooks.preview.json_label">JSON payload</Trans>
                                                </p>
                                                <pre className="mt-1 overflow-x-auto rounded-md bg-surface px-3 py-2 text-xs leading-relaxed text-content-secondary"><code>{webhookPayload}</code></pre>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="webhookName" className="block text-sm font-medium text-content mb-1">
                                <Trans id="settings.webhooks.form.name">Display name (optional)</Trans>
                            </label>
                            <Input
                                density="compact"
                                id="webhookName"
                                type="text"
                                placeholder={t({
                                    id: 'settings.webhooks.form.name_placeholder',
                                    message: 'For example: New post alerts'
                                })}
                                {...register('webhookName')}
                            />
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <Button
                                density="compact"
                                variant="ghost"
                                size="md"
                                type="button"
                                className="min-h-11! [@media(pointer:fine)]:min-h-10!"
                                onClick={handleCancel}
                                disabled={isAdding || isTesting}>
                                <Trans id="common.cancel">Cancel</Trans>
                            </Button>

                            <div className="flex flex-wrap items-center gap-3">
                                <Button
                                    density="compact"
                                    variant="secondary"
                                    size="md"
                                    type="button"
                                    className="min-h-11! [@media(pointer:fine)]:min-h-10!"
                                    isLoading={isTesting}
                                    disabled={isAdding}
                                    onClick={handleTest}>
                                    {isTesting
                                        ? <Trans id="settings.webhooks.test.sending">Sending…</Trans>
                                        : <Trans id="settings.webhooks.test.action">Test</Trans>}
                                </Button>
                                <Button
                                    density="compact"
                                    variant="primary"
                                    size="md"
                                    type="submit"
                                    className="min-h-11! [@media(pointer:fine)]:min-h-10!"
                                    isLoading={isAdding}
                                    disabled={isTesting}>
                                    {isAdding
                                        ? <Trans id="settings.webhooks.adding">Adding…</Trans>
                                        : <Trans id="settings.webhooks.add">Add</Trans>}
                                </Button>
                            </div>
                        </div>
                    </div>
                </form>
            )}

            {channels && channels.length > 0 ? (
                <div className="space-y-3">
                    {channels.map((channel) => {
                        const channelName = channel.name || t({
                            id: 'settings.webhooks.unnamed_channel',
                            message: 'Unnamed destination'
                        });

                        return (
                            <SettingsListItem
                                key={channel.id}
                                left={
                                    <div className={getSettingsIconClass('default')}>
                                        {channel.isActive
                                            ? <Zap aria-hidden="true" className="h-4 w-4" />
                                            : <AlertTriangle aria-hidden="true" className="h-4 w-4" />}
                                    </div>
                                }
                                actions={
                                    <Dropdown
                                        density="compact"
                                        triggerAriaLabel={i18n._({
                                            id: 'settings.webhooks.menu.open',
                                            message: 'Open the webhook menu for {name}',
                                            values: { name: channelName }
                                        })}
                                        triggerClassName="min-h-11 min-w-11 [@media(pointer:fine)]:min-h-9 [@media(pointer:fine)]:min-w-9"
                                        items={[
                                            {
                                                label: t({
                                                    id: 'common.delete',
                                                    message: 'Delete'
                                                }),
                                                icon: <Trash2 aria-hidden="true" className="h-4 w-4" />,
                                                onClick: () => handleDelete(channel.id),
                                                variant: 'danger'
                                            }
                                        ]}
                                    />
                                }>
                                <h3 className={`${SETTINGS_LIST_TITLE} mb-0.5`}>
                                    {channelName}
                                </h3>
                                <div className={`${SETTINGS_LIST_META} flex flex-wrap items-center gap-3`}>
                                    <span className="flex items-center truncate max-w-[200px]" title={channel.webhookUrl}>
                                        <LinkIcon aria-hidden="true" className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                                        {channel.webhookUrl.replace(/^https?:\/\//, '').slice(0, 30)}...
                                    </span>
                                    <span className="flex items-center">
                                        <Clock aria-hidden="true" className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                                        {formatDateTime(
                                            channel.createdDate,
                                            normalizeLocale(i18n.locale),
                                            channel.createdDate
                                        )}
                                    </span>
                                    {getStatusBadge(channel)}
                                </div>
                            </SettingsListItem>
                        );
                    })}
                </div>
            ) : !showAddForm ? (
                <SettingsEmptyState
                    icon={<Zap aria-hidden="true" className="h-4 w-4" />}
                    title={emptyTitle}
                    description={emptyDescription}
                    action={createAction}
                />
            ) : null}
        </div>
    );
};

export default WebhookChannelManager;
