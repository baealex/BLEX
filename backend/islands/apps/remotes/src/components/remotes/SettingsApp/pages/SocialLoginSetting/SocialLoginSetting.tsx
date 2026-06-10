import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { SettingsHeader } from '../../components';
import { Toggle } from '@blex/ui/toggle';
import { Button, Card, Input } from '~/components/shared';
import { toast } from '~/utils/toast';
import {
    getSiteSettings,
    updateSiteSettings,
    type SiteSettingData,
    type SiteSettingUpdateData,
    type SocialAuthProviderSetting
} from '~/lib/api/settings';

interface SocialAuthProviderForm extends SocialAuthProviderSetting {
    clientSecret: string;
    clearClientSecret: boolean;
}

interface SavedSocialAuthProviderForm {
    key: string;
    isEnabled: boolean;
    clientId: string;
    hasClientSecret: boolean;
}

const assertDone = (response: Awaited<ReturnType<typeof updateSiteSettings>>, fallbackMessage: string) => {
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

const toSocialAuthProviderForms = (providers: SocialAuthProviderSetting[] | undefined): SocialAuthProviderForm[] => (
    providers ?? []
).map((provider) => ({
    ...provider,
    clientSecret: '',
    clearClientSecret: false
}));

const toSavedSocialAuthProviderForms = (providers: SocialAuthProviderForm[]): SavedSocialAuthProviderForm[] => (
    providers.map((provider) => ({
        key: provider.key,
        isEnabled: provider.isEnabled,
        clientId: provider.clientId,
        hasClientSecret: provider.hasClientSecret
    }))
);

const hasSocialAuthProvidersChanged = (
    current: SocialAuthProviderForm[],
    saved: SavedSocialAuthProviderForm[] | null
) => {
    if (!saved || current.length !== saved.length) return Boolean(saved);

    return current.some((provider) => {
        const savedProvider = saved.find((item) => item.key === provider.key);
        if (!savedProvider) return true;
        return provider.isEnabled !== savedProvider.isEnabled
            || provider.clientId !== savedProvider.clientId
            || provider.hasClientSecret !== savedProvider.hasClientSecret
            || provider.clientSecret.length > 0
            || provider.clearClientSecret;
    });
};

const SocialLoginSetting = () => {
    const queryClient = useQueryClient();
    const hasHydratedFormRef = useRef(false);
    const savedSocialAuthProvidersRef = useRef<SavedSocialAuthProviderForm[] | null>(null);
    const { data: settingData } = useSuspenseQuery({
        queryKey: ['site-settings'],
        queryFn: async () => {
            const { data } = await getSiteSettings();
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error('사이트 설정을 불러오는데 실패했습니다.');
        }
    });

    const [socialAuthProviders, setSocialAuthProviders] = useState<SocialAuthProviderForm[]>([]);

    useEffect(() => {
        if (!hasHydratedFormRef.current) {
            const providerForms = toSocialAuthProviderForms(settingData.socialAuthProviders);
            setSocialAuthProviders(providerForms);
            savedSocialAuthProvidersRef.current = toSavedSocialAuthProviderForms(providerForms);
            hasHydratedFormRef.current = true;
        }
    }, [settingData]);

    const updateMutation = useMutation({
        mutationFn: async (data: SiteSettingUpdateData) => {
            const response = await updateSiteSettings(data);
            return assertDone(response, '소셜 로그인 설정 저장에 실패했습니다.');
        },
        onSuccess: (body: SiteSettingData) => {
            const providerForms = toSocialAuthProviderForms(body.socialAuthProviders);
            setSocialAuthProviders(providerForms);
            savedSocialAuthProvidersRef.current = toSavedSocialAuthProviderForms(providerForms);
            void queryClient.invalidateQueries({ queryKey: ['site-settings'] });
            toast.success('소셜 로그인 설정이 저장되었습니다.');
        },
        onError: (error) => {
            toast.error(getErrorMessage(error, '소셜 로그인 설정 저장에 실패했습니다.'));
        }
    });

    const updateSocialProvider = (key: string, patch: Partial<SocialAuthProviderForm>) => {
        setSocialAuthProviders((providers) => providers.map((provider) => (
            provider.key === key
                ? {
                    ...provider,
                    ...patch
                }
                : provider
        )));
    };

    const handleSave = (event?: FormEvent<HTMLFormElement>) => {
        event?.preventDefault();
        updateMutation.mutate({
            social_auth_providers: socialAuthProviders.map((provider) => ({
                key: provider.key,
                is_enabled: provider.isEnabled,
                client_id: provider.clientId,
                ...(provider.clientSecret ? { client_secret: provider.clientSecret } : {}),
                ...(provider.clearClientSecret ? { clear_client_secret: true } : {})
            }))
        });
    };

    const isDirty = hasSocialAuthProvidersChanged(socialAuthProviders, savedSocialAuthProvidersRef.current);

    return (
        <form className="space-y-8" onSubmit={handleSave}>
            <SettingsHeader
                title="소셜 로그인"
                description="Google, GitHub OAuth 로그인 사용 여부와 앱 키를 관리합니다."
            />

            <Card
                title="설정 방법"
                subtitle="OAuth 앱을 만든 뒤 콜백 URL과 앱 키를 등록합니다."
                icon={<i className="fas fa-circle-info" />}>
                <ol className="space-y-2 text-sm leading-relaxed text-content-secondary">
                    <li>1. Google/GitHub에서 OAuth 앱을 생성합니다.</li>
                    <li>
                        2. 콜백 URL을{' '}
                        <code className="rounded-md bg-surface-subtle px-2 py-1 text-xs text-content-secondary">
                            /login/callback/provider
                        </code>
                        {' '}형태로 등록합니다.
                    </li>
                    <li>3. Client ID와 Secret을 입력하고 사용을 켭니다.</li>
                </ol>
            </Card>

            {socialAuthProviders.map((provider) => (
                <Card
                    key={provider.key}
                    title={provider.name}
                    subtitle={`콜백 URL: /login/callback/${provider.key}`}
                    icon={<i className="fas fa-right-to-bracket" />}>
                    <div className="space-y-6">
                        <div className="flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <div className="text-sm font-semibold text-content">로그인 사용</div>
                                <p className="mt-1 text-xs leading-relaxed text-content-secondary">
                                    켜면 로그인/회원가입 화면에 {provider.name} 버튼이 표시됩니다.
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-medium text-content-secondary">
                                    {provider.isEnabled ? 'ON' : 'OFF'}
                                </span>
                                <Toggle
                                    checked={provider.isEnabled}
                                    disabled={updateMutation.isPending}
                                    onCheckedChange={(checked) => updateSocialProvider(provider.key, { isEnabled: checked })}
                                    aria-label={`${provider.name} 소셜 로그인 사용`}
                                />
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <Input
                                label="Client ID"
                                placeholder={`${provider.name} OAuth Client ID`}
                                value={provider.clientId}
                                onChange={(event) => updateSocialProvider(provider.key, { clientId: event.target.value })}
                            />
                            <Input
                                label="Client Secret"
                                type="password"
                                placeholder={provider.hasClientSecret ? '저장된 값 유지' : `${provider.name} OAuth Client Secret`}
                                value={provider.clientSecret}
                                onChange={(event) => updateSocialProvider(provider.key, {
                                    clientSecret: event.target.value,
                                    clearClientSecret: false
                                })}
                                helperText={provider.hasClientSecret ? '새 값을 입력하지 않으면 기존 secret을 유지합니다.' : undefined}
                            />
                        </div>

                        {provider.hasClientSecret && (
                            <label className="inline-flex min-h-11 items-center gap-2 text-xs text-content-secondary">
                                <input
                                    type="checkbox"
                                    checked={provider.clearClientSecret}
                                    onChange={(event) => updateSocialProvider(provider.key, {
                                        clearClientSecret: event.target.checked,
                                        clientSecret: event.target.checked ? '' : provider.clientSecret
                                    })}
                                />
                                저장된 Client Secret 삭제
                            </label>
                        )}
                    </div>
                </Card>
            ))}

            <div className="sticky bottom-0 z-10 -mx-4 flex justify-end bg-surface-page/95 px-4 py-3 backdrop-blur md:mx-0 md:px-0">
                <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={updateMutation.isPending}
                    disabled={!isDirty || updateMutation.isPending}
                    leftIcon={!updateMutation.isPending ? <i className="fas fa-check" /> : undefined}>
                    {updateMutation.isPending ? '저장 중...' : '소셜 로그인 설정 저장'}
                </Button>
            </div>
        </form>
    );
};

export default SocialLoginSetting;
