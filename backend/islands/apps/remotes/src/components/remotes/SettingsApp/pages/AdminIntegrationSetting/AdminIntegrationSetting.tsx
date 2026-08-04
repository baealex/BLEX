import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useLingui } from '@lingui/react/macro';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Check, Send } from '@blex/ui/icons';
import { Toggle } from '@blex/ui/toggle';
import { SettingsHeader } from '../../components';
import { Button, Card, Checkbox, Input } from '~/components/shared';
import { toast } from '~/utils/toast';
import {
    getIntegrationSettings,
    updateIntegrationSettings,
    type IntegrationSettingData,
    type IntegrationSettingUpdateData
} from '~/lib/api/settings';

interface IntegrationSettingsForm {
    telegramEnabled: boolean;
    telegramBotUsername: string;
    telegramBotToken: string;
    telegramHasBotToken: boolean;
    clearTelegramBotToken: boolean;
}

interface SavedIntegrationSettingsForm {
    telegramEnabled: boolean;
    telegramBotUsername: string;
    telegramHasBotToken: boolean;
}

const EMPTY_INTEGRATION_SETTINGS_FORM: IntegrationSettingsForm = {
    telegramEnabled: false,
    telegramBotUsername: '',
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
    telegramBotUsername: data.telegramBotUsername,
    telegramBotToken: '',
    telegramHasBotToken: data.telegramHasBotToken,
    clearTelegramBotToken: false
});

const toSavedIntegrationSettingsForm = (form: IntegrationSettingsForm): SavedIntegrationSettingsForm => ({
    telegramEnabled: form.telegramEnabled,
    telegramBotUsername: form.telegramBotUsername,
    telegramHasBotToken: form.telegramHasBotToken
});

const hasIntegrationSettingsChanged = (
    current: IntegrationSettingsForm,
    saved: SavedIntegrationSettingsForm | null
) => {
    if (!saved) return false;

    return current.telegramEnabled !== saved.telegramEnabled
        || current.telegramBotUsername !== saved.telegramBotUsername
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
        queryKey: ['integration-settings'],
        queryFn: async () => {
            const { data } = await getIntegrationSettings();
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error(data.errorMessage || t({
                id: 'settings.admin.telegram.load_failed',
                message: 'Could not load Telegram settings.'
            }));
        }
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
            void queryClient.invalidateQueries({ queryKey: ['integration-settings'] });
            toast.success(t({
                id: 'settings.admin.telegram.save_success',
                message: 'Telegram settings saved.'
            }));
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
            telegram_enabled: integrationSettings.telegramEnabled,
            telegram_bot_username: integrationSettings.telegramBotUsername,
            ...(integrationSettings.telegramBotToken.trim()
                ? { telegram_bot_token: integrationSettings.telegramBotToken }
                : {}),
            ...(integrationSettings.clearTelegramBotToken ? { clear_telegram_bot_token: true } : {})
        });
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
                                id: 'settings.admin.telegram.bot.username.label',
                                message: 'Bot username'
                            })}
                            name="blex_telegram_bot_public_value"
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                            data-1p-ignore="true"
                            data-bwignore="true"
                            data-lpignore="true"
                            placeholder="your_bot"
                            value={integrationSettings.telegramBotUsername}
                            onChange={(event) => updateIntegrationSettingsForm({ telegramBotUsername: event.target.value })}
                            helperText={t({
                                id: 'settings.admin.telegram.bot.username.helper',
                                message: 'You can enter it without the @ symbol.'
                            })}
                        />
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
                                : undefined}
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
