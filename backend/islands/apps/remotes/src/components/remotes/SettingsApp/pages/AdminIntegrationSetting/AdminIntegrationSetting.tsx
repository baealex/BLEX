import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
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
            throw new Error('텔레그램 설정을 불러오는데 실패했습니다.');
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
            return assertDone(response, '텔레그램 설정 저장에 실패했습니다.');
        },
        onSuccess: (body: IntegrationSettingData) => {
            const integrationSettingsForm = toIntegrationSettingsForm(body);
            setIntegrationSettings(integrationSettingsForm);
            savedIntegrationSettingsRef.current = toSavedIntegrationSettingsForm(integrationSettingsForm);
            void queryClient.invalidateQueries({ queryKey: ['integration-settings'] });
            toast.success('텔레그램 설정이 저장되었습니다.');
        },
        onError: (error) => {
            toast.error(getErrorMessage(error, '텔레그램 설정 저장에 실패했습니다.'));
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
                title="텔레그램"
                description="사이트 알림을 텔레그램으로 확장합니다."
            />

            <Card
                title="봇 설정"
                subtitle="사용자 알림을 텔레그램으로 보낼 봇을 설정합니다."
                icon={<i className="fab fa-telegram-plane" />}>
                <div className="space-y-5">
                    <div className="flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="text-sm font-semibold text-content">텔레그램 사용</div>
                            <p className="mt-1 text-xs leading-relaxed text-content-secondary">
                                켜면 사용자가 텔레그램을 연결하고 주요 알림을 받을 수 있습니다.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-medium text-content-secondary">
                                {integrationSettings.telegramEnabled ? 'ON' : 'OFF'}
                            </span>
                            <Toggle
                                checked={integrationSettings.telegramEnabled}
                                disabled={updateMutation.isPending}
                                onCheckedChange={(checked) => updateIntegrationSettingsForm({ telegramEnabled: checked })}
                                aria-label="텔레그램 사용"
                            />
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <Input
                            label="봇 사용자명"
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
                            helperText="@ 없이 입력해도 됩니다."
                        />
                        <Input
                            label="봇 토큰"
                            type="password"
                            name="blex_telegram_bot_private_value"
                            autoComplete="new-password"
                            autoCorrect="off"
                            spellCheck={false}
                            data-1p-ignore="true"
                            data-bwignore="true"
                            data-lpignore="true"
                            placeholder={integrationSettings.telegramHasBotToken ? '저장된 값 유지' : 'Telegram Bot Token'}
                            value={integrationSettings.telegramBotToken}
                            onChange={(event) => updateIntegrationSettingsForm({
                                telegramBotToken: event.target.value,
                                clearTelegramBotToken: false
                            })}
                            helperText={integrationSettings.telegramHasBotToken ? '새 값을 입력하지 않으면 기존 토큰을 유지합니다.' : undefined}
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
                            label="저장된 텔레그램 봇 토큰 삭제"
                            description="삭제 후 텔레그램을 계속 사용하려면 새 봇 토큰을 입력해야 합니다."
                        />
                    )}
                </div>
            </Card>

            <div className="sticky bottom-0 z-10 -mx-4 flex justify-end bg-surface-page/95 px-4 py-3 backdrop-blur md:mx-0 md:px-0">
                <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={updateMutation.isPending}
                    disabled={!isDirty || updateMutation.isPending}
                    leftIcon={!updateMutation.isPending ? <i className="fas fa-check" /> : undefined}>
                    {updateMutation.isPending ? '저장 중...' : '텔레그램 설정 저장'}
                </Button>
            </div>
        </form>
    );
};

export default AdminIntegrationSetting;
