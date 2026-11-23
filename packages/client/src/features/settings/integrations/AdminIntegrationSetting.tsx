import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useLingui } from '@lingui/react/macro';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Check, Send } from '~/ui/icons';
import { Toggle } from '~/ui/toggle';
import { SettingsHeader } from '../layout';
import { Button, Card, Checkbox, Input } from '~/components/shared';
import { toast } from '~/utils/toast';
import {
    getIntegrationSettings,
    updateIntegrationSettings,
    type IntegrationSettingData,
    type IntegrationSettingUpdateData
} from '~/lib/api/settings';
import TelegramConnectionNotice from './components/TelegramConnectionNotice';

interface IntegrationSettingsForm {
    telegramEnabled: boolean;
    telegramBotToken: string;
    telegramHasBotToken: boolean;
    clearTelegramBotToken: boolean;
}

interface SavedIntegrationSettingsForm {
    telegramEnabled: boolean;
    telegramHasBotToken: boolean;
}

// The response carries live Telegram webhook status, so it is never restored from sessionStorage.
// The key changed with that field, which keeps cached responses without it out of this screen.
const INTEGRATION_SETTINGS_QUERY_KEY = ['integration-settings', 'telegram-connection'];

const EMPTY_INTEGRATION_SETTINGS_FORM: IntegrationSettingsForm = {
    telegramEnabled: false,
    telegramBotToken: '',
    telegramHasBotToken: false,
    clearTelegramBotToken: false
};

const assertDone = (response: Awaited<ReturnType<typeof updateIntegrationSettings>>, fallbackMessage: string) => {
    if (response.data.status !== 'DONE') {
        throw new Error(response.data.errorMessage || fallbackMessage);
    }
    return response.data.body;
};

const getErrorMessage = (error: unknown, fallbackMessage: string) => {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallbackMessage;
};

const toIntegrationSettingsForm = (data: IntegrationSettingData): IntegrationSettingsForm => ({
    telegramEnabled: data.telegramEnabled,
    telegramBotToken: '',
    telegramHasBotToken: data.telegramHasBotToken,
    clearTelegramBotToken: false
});

const toSavedIntegrationSettingsForm = (form: IntegrationSettingsForm): SavedIntegrationSettingsForm => ({
    telegramEnabled: form.telegramEnabled,
    telegramHasBotToken: form.telegramHasBotToken
});

const hasIntegrationSettingsChanged = (
    current: IntegrationSettingsForm,
    saved: SavedIntegrationSettingsForm | null
) => {
    if (!saved) return false;

    return current.telegramEnabled !== saved.telegramEnabled
        || current.telegramHasBotToken !== saved.telegramHasBotToken
        || current.telegramBotToken.trim().length > 0
        || current.clearTelegramBotToken;
};

const AdminIntegrationSetting = () => {
    const { t } = useLingui();
    const queryClient = useQueryClient();
    const hasHydratedFormRef = useRef(false);
    const savedIntegrationSettingsRef = useRef<SavedIntegrationSettingsForm | null>(null);
    const { data: settingData } = useSuspenseQuery({
        queryKey: INTEGRATION_SETTINGS_QUERY_KEY,
        queryFn: async () => {
            const { data } = await getIntegrationSettings();
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error(data.errorMessage || t({
                id: 'settings.admin.telegram.load_failed',
                message: 'Could not load Telegram settings.'
            }));
        },
        meta: { persist: false }
    });

    const [integrationSettings, setIntegrationSettings] = useState<IntegrationSettingsForm>(
        EMPTY_INTEGRATION_SETTINGS_FORM
    );

    useEffect(() => {
        if (!hasHydratedFormRef.current) {
            const integrationSettingsForm = toIntegrationSettingsForm(settingData);
            setIntegrationSettings(integrationSettingsForm);
            savedIntegrationSettingsRef.current = toSavedIntegrationSettingsForm(integrationSettingsForm);
            hasHydratedFormRef.current = true;
        }
    }, [settingData]);

    const updateMutation = useMutation({
        mutationFn: async (data: IntegrationSettingUpdateData) => {
            const response = await updateIntegrationSettings(data);
            return assertDone(response, t({
                id: 'settings.admin.telegram.save_failed',
                message: 'Could not save Telegram settings.'
            }));
        },
        onSuccess: (body: IntegrationSettingData) => {
            const integrationSettingsForm = toIntegrationSettingsForm(body);
            setIntegrationSettings(integrationSettingsForm);
            savedIntegrationSettingsRef.current = toSavedIntegrationSettingsForm(integrationSettingsForm);
            queryClient.setQueryData(INTEGRATION_SETTINGS_QUERY_KEY, body);
            const connectionState = body.telegramConnection.state;
            if (connectionState === 'connected' || connectionState === 'disabled') {
                toast.success(t({
                    id: 'settings.admin.telegram.save_success',
                    message: 'Telegram settings saved.'
                }));
            } else {
                toast.warning(t({
                    id: 'settings.admin.telegram.save_connection_warning',
                    message: 'Settings saved, but Telegram is not connected yet. Check the status above.'
                }));
            }
        },
        onError: (error) => {
            toast.error(getErrorMessage(error, t({
                id: 'settings.admin.telegram.save_failed',
                message: 'Could not save Telegram settings.'
            })));
        }
    });

    const updateIntegrationSettingsForm = (patch: Partial<IntegrationSettingsForm>) => {
        setIntegrationSettings((current) => ({
            ...current,
            ...patch
        }));
    };

    const handleSave = (event?: FormEvent<HTMLFormElement>) => {
        event?.preventDefault();
        updateMutation.mutate({
            telegramEnabled: integrationSettings.telegramEnabled,
            ...(integrationSettings.telegramBotToken.trim()
                ? { telegramBotToken: integrationSettings.telegramBotToken }
                : {}),
            ...(integrationSettings.clearTelegramBotToken ? { clearTelegramBotToken: true } : {})
        });
    };

    const reconnectTelegram = () => {
        updateMutation.mutate({ telegramEnabled: true });
    };

    const isDirty = hasIntegrationSettingsChanged(integrationSettings, savedIntegrationSettingsRef.current);

    return (
        <form className="space-y-8" onSubmit={handleSave} autoComplete="off">
            <SettingsHeader
                title={t({
                    id: 'settings.admin.telegram.title',
                    message: 'Telegram'
                })}
            />

            <Card
                title={t({
                    id: 'settings.admin.telegram.bot.title',
                    message: 'Bot settings'
                })}
                icon={<Send aria-hidden="true" className="h-4 w-4" />}>
                <div className="space-y-5">
                    <TelegramConnectionNotice
                        connection={settingData.telegramConnection}
                        botUsername={settingData.telegramBotUsername}
                        isReconnecting={updateMutation.isPending}
                        canReconnect={!isDirty && !updateMutation.isPending}
                        onReconnect={reconnectTelegram}
                    />

                    <div className="flex items-start justify-between gap-4 border-b border-line pb-5">
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-content">
                                {t({
                                    id: 'settings.admin.telegram.enabled.label',
                                    message: 'Enable Telegram'
                                })}
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-content-secondary">
                                {t({
                                    id: 'settings.admin.telegram.enabled.description',
                                    message: 'Allow users to connect Telegram and receive important notifications.'
                                })}
                            </p>
                        </div>
                        <Toggle
                            checked={integrationSettings.telegramEnabled}
                            disabled={updateMutation.isPending}
                            onCheckedChange={(checked) => updateIntegrationSettingsForm({ telegramEnabled: checked })}
                            aria-label={t({
                                id: 'settings.admin.telegram.enabled.label',
                                message: 'Enable Telegram'
                            })}
                        />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <Input
                            density="compact"
                            label={t({
                                id: 'settings.admin.telegram.bot.token.label',
                                message: 'Bot token'
                            })}
                            type="password"
                            name="blex_telegram_bot_private_value"
                            autoComplete="new-password"
                            autoCorrect="off"
                            spellCheck={false}
                            data-1p-ignore="true"
                            data-bwignore="true"
                            data-lpignore="true"
                            placeholder={integrationSettings.telegramHasBotToken
                                ? t({
                                    id: 'settings.admin.telegram.bot.token.keep_placeholder',
                                    message: 'Keep saved value'
                                })
                                : 'Telegram Bot Token'}
                            value={integrationSettings.telegramBotToken}
                            onChange={(event) => updateIntegrationSettingsForm({
                                telegramBotToken: event.target.value,
                                clearTelegramBotToken: false
                            })}
                            helperText={integrationSettings.telegramHasBotToken
                                ? t({
                                    id: 'settings.admin.telegram.bot.token.helper',
                                    message: 'Leave this blank to keep the existing token.'
                                })
                                : t({
                                    id: 'settings.admin.telegram.bot.token.new_helper',
                                    message: 'Paste the token from @BotFather. BLEX finds the bot name and connects it to Telegram when you save.'
                                })}
                        />
                    </div>

                    {integrationSettings.telegramHasBotToken && (
                        <Checkbox
                            checked={integrationSettings.clearTelegramBotToken}
                            disabled={updateMutation.isPending}
                            onCheckedChange={(checked) => updateIntegrationSettingsForm({
                                clearTelegramBotToken: checked,
                                telegramBotToken: checked ? '' : integrationSettings.telegramBotToken
                            })}
                            label={t({
                                id: 'settings.admin.telegram.bot.token.clear_label',
                                message: 'Delete saved Telegram bot token'
                            })}
                            description={t({
                                id: 'settings.admin.telegram.bot.token.clear_description',
                                message: 'Enter a new bot token to keep using Telegram after deletion.'
                            })}
                        />
                    )}
                </div>
            </Card>

            <div className="sticky bottom-0 z-10 -mx-4 flex justify-end bg-surface-page/95 px-4 py-3 backdrop-blur md:mx-0 md:px-0">
                <Button
                    density="compact"
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={updateMutation.isPending}
                    disabled={!isDirty || updateMutation.isPending}
                    leftIcon={!updateMutation.isPending
                        ? <Check aria-hidden="true" className="h-4 w-4" />
                        : undefined}>
                    {updateMutation.isPending
                        ? t({
                            id: 'common.saving',
                            message: 'Saving'
                        })
                        : t({
                            id: 'settings.admin.telegram.save',
                            message: 'Save Telegram settings'
                        })}
                </Button>
            </div>
        </form>
    );
};

export default AdminIntegrationSetting;
