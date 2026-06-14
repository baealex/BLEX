import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { SettingsHeader } from '../../components';
import { Toggle } from '@blex/ui/toggle';
import { Button, Card, Checkbox, Input } from '~/components/shared';
import { toast } from '~/utils/toast';
import {
    getLoginSettings,
    updateLoginSettings,
    type LoginSettingData,
    type LoginSettingUpdateData,
    type SocialAuthProviderSetting
} from '~/lib/api/settings';

interface LoginSettingsForm {
    welcomeMessage: string;
    welcomeUrl: string;
    deletionRedirectUrl: string;
    hcaptchaEnabled: boolean;
    hcaptchaSiteKey: string;
    hcaptchaSecretKey: string;
    hcaptchaHasSecretKey: boolean;
    clearHcaptchaSecretKey: boolean;
}

interface SavedLoginSettingsForm {
    welcomeMessage: string;
    welcomeUrl: string;
    deletionRedirectUrl: string;
    hcaptchaEnabled: boolean;
    hcaptchaSiteKey: string;
    hcaptchaHasSecretKey: boolean;
}

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

const EMPTY_LOGIN_SETTINGS_FORM: LoginSettingsForm = {
    welcomeMessage: '',
    welcomeUrl: '/',
    deletionRedirectUrl: '',
    hcaptchaEnabled: false,
    hcaptchaSiteKey: '',
    hcaptchaSecretKey: '',
    hcaptchaHasSecretKey: false,
    clearHcaptchaSecretKey: false
};

const assertDone = (response: Awaited<ReturnType<typeof updateLoginSettings>>, fallbackMessage: string) => {
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

const toLoginSettingsForm = (data: LoginSettingData): LoginSettingsForm => ({
    welcomeMessage: data.welcomeNotificationMessage,
    welcomeUrl: data.welcomeNotificationUrl,
    deletionRedirectUrl: data.accountDeletionRedirectUrl,
    hcaptchaEnabled: data.hcaptchaEnabled,
    hcaptchaSiteKey: data.hcaptchaSiteKey,
    hcaptchaSecretKey: '',
    hcaptchaHasSecretKey: data.hcaptchaHasSecretKey,
    clearHcaptchaSecretKey: false
});

const toSavedLoginSettingsForm = (form: LoginSettingsForm): SavedLoginSettingsForm => ({
    welcomeMessage: form.welcomeMessage,
    welcomeUrl: form.welcomeUrl,
    deletionRedirectUrl: form.deletionRedirectUrl,
    hcaptchaEnabled: form.hcaptchaEnabled,
    hcaptchaSiteKey: form.hcaptchaSiteKey,
    hcaptchaHasSecretKey: form.hcaptchaHasSecretKey
});

const hasLoginSettingsChanged = (
    current: LoginSettingsForm,
    saved: SavedLoginSettingsForm | null
) => {
    if (!saved) return false;

    return current.welcomeMessage !== saved.welcomeMessage
        || current.welcomeUrl !== saved.welcomeUrl
        || current.deletionRedirectUrl !== saved.deletionRedirectUrl
        || current.hcaptchaEnabled !== saved.hcaptchaEnabled
        || current.hcaptchaSiteKey !== saved.hcaptchaSiteKey
        || current.hcaptchaHasSecretKey !== saved.hcaptchaHasSecretKey
        || current.hcaptchaSecretKey.trim().length > 0
        || current.clearHcaptchaSecretKey;
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
            || provider.clientSecret.trim().length > 0
            || provider.clearClientSecret;
    });
};

const LoginSetting = () => {
    const queryClient = useQueryClient();
    const hasHydratedFormRef = useRef(false);
    const savedLoginSettingsRef = useRef<SavedLoginSettingsForm | null>(null);
    const savedSocialAuthProvidersRef = useRef<SavedSocialAuthProviderForm[] | null>(null);
    const { data: settingData } = useSuspenseQuery({
        queryKey: ['login-settings'],
        queryFn: async () => {
            const { data } = await getLoginSettings();
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error('로그인 관리 설정을 불러오는데 실패했습니다.');
        }
    });

    const [loginSettings, setLoginSettings] = useState<LoginSettingsForm>(EMPTY_LOGIN_SETTINGS_FORM);
    const [socialAuthProviders, setSocialAuthProviders] = useState<SocialAuthProviderForm[]>([]);

    useEffect(() => {
        if (!hasHydratedFormRef.current) {
            const loginSettingsForm = toLoginSettingsForm(settingData);
            const providerForms = toSocialAuthProviderForms(settingData.socialAuthProviders);
            setLoginSettings(loginSettingsForm);
            setSocialAuthProviders(providerForms);
            savedLoginSettingsRef.current = toSavedLoginSettingsForm(loginSettingsForm);
            savedSocialAuthProvidersRef.current = toSavedSocialAuthProviderForms(providerForms);
            hasHydratedFormRef.current = true;
        }
    }, [settingData]);

    const updateMutation = useMutation({
        mutationFn: async (data: LoginSettingUpdateData) => {
            const response = await updateLoginSettings(data);
            return assertDone(response, '로그인 관리 설정 저장에 실패했습니다.');
        },
        onSuccess: (body: LoginSettingData) => {
            const loginSettingsForm = toLoginSettingsForm(body);
            const providerForms = toSocialAuthProviderForms(body.socialAuthProviders);
            setLoginSettings(loginSettingsForm);
            setSocialAuthProviders(providerForms);
            savedLoginSettingsRef.current = toSavedLoginSettingsForm(loginSettingsForm);
            savedSocialAuthProvidersRef.current = toSavedSocialAuthProviderForms(providerForms);
            void queryClient.invalidateQueries({ queryKey: ['login-settings'] });
            toast.success('로그인 관리 설정이 저장되었습니다.');
        },
        onError: (error) => {
            toast.error(getErrorMessage(error, '로그인 관리 설정 저장에 실패했습니다.'));
        }
    });

    const updateLoginSettingsForm = (patch: Partial<LoginSettingsForm>) => {
        setLoginSettings((current) => ({
            ...current,
            ...patch
        }));
    };

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
            welcome_notification_message: loginSettings.welcomeMessage,
            welcome_notification_url: loginSettings.welcomeUrl,
            account_deletion_redirect_url: loginSettings.deletionRedirectUrl,
            hcaptcha_enabled: loginSettings.hcaptchaEnabled,
            hcaptcha_site_key: loginSettings.hcaptchaSiteKey,
            ...(loginSettings.hcaptchaSecretKey.trim() ? { hcaptcha_secret_key: loginSettings.hcaptchaSecretKey } : {}),
            ...(loginSettings.clearHcaptchaSecretKey ? { clear_hcaptcha_secret_key: true } : {}),
            social_auth_providers: socialAuthProviders.map((provider) => ({
                key: provider.key,
                is_enabled: provider.isEnabled,
                client_id: provider.clientId,
                ...(provider.clientSecret.trim() ? { client_secret: provider.clientSecret } : {}),
                ...(provider.clearClientSecret ? { clear_client_secret: true } : {})
            }))
        });
    };

    const loginSettingsDirty = hasLoginSettingsChanged(loginSettings, savedLoginSettingsRef.current);
    const socialAuthProvidersDirty = hasSocialAuthProvidersChanged(
        socialAuthProviders,
        savedSocialAuthProvidersRef.current
    );
    const isDirty = loginSettingsDirty || socialAuthProvidersDirty;

    return (
        <form className="space-y-8" onSubmit={handleSave} autoComplete="off">
            <SettingsHeader
                title="로그인 관리"
                description="회원 안내, 소셜 로그인, 회원가입 인증을 관리합니다."
            />

            <Card
                title="회원 안내"
                subtitle="회원 가입과 탈퇴 흐름에서 사용할 안내를 설정합니다."
                icon={<i className="fas fa-user-gear" />}>
                <div className="space-y-4">
                    <Input
                        label="가입 환영 메시지"
                        multiline
                        rows={3}
                        placeholder="환영합니다, {name}님! BLEX에 오신 것을 환영합니다."
                        value={loginSettings.welcomeMessage}
                        onChange={(event) => updateLoginSettingsForm({ welcomeMessage: event.target.value })}
                        helperText="{name}을 사용하면 사용자 이름으로 치환됩니다."
                    />
                    <Input
                        label="환영 알림 클릭 URL"
                        placeholder="/"
                        value={loginSettings.welcomeUrl}
                        onChange={(event) => updateLoginSettingsForm({ welcomeUrl: event.target.value })}
                    />
                    <Input
                        label="탈퇴 후 리다이렉트 URL"
                        placeholder="https://forms.example.com/exit-survey"
                        value={loginSettings.deletionRedirectUrl}
                        onChange={(event) => updateLoginSettingsForm({ deletionRedirectUrl: event.target.value })}
                        helperText="비워두면 메인 페이지로 이동합니다."
                    />
                </div>
            </Card>

            <Card
                title="로그인 인증"
                subtitle="회원가입 시 hCaptcha 검증을 사용합니다."
                icon={<i className="fas fa-shield-halved" />}>
                <div className="space-y-5">
                    <div className="flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="text-sm font-semibold text-content">hCaptcha 사용</div>
                            <p className="mt-1 text-xs leading-relaxed text-content-secondary">
                                켜면 회원가입 요청에 hCaptcha 토큰 검증이 필요합니다.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-medium text-content-secondary">
                                {loginSettings.hcaptchaEnabled ? 'ON' : 'OFF'}
                            </span>
                            <Toggle
                                checked={loginSettings.hcaptchaEnabled}
                                disabled={updateMutation.isPending}
                                onCheckedChange={(checked) => updateLoginSettingsForm({ hcaptchaEnabled: checked })}
                                aria-label="hCaptcha 사용"
                            />
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <Input
                            label="Site Key"
                            name="blex_hcaptcha_public_value"
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                            data-1p-ignore="true"
                            data-bwignore="true"
                            data-lpignore="true"
                            value={loginSettings.hcaptchaSiteKey}
                            onChange={(event) => updateLoginSettingsForm({ hcaptchaSiteKey: event.target.value })}
                            placeholder="hCaptcha Site Key"
                        />
                        <Input
                            label="Secret Key"
                            type="password"
                            name="blex_hcaptcha_private_value"
                            autoComplete="new-password"
                            autoCorrect="off"
                            spellCheck={false}
                            data-1p-ignore="true"
                            data-bwignore="true"
                            data-lpignore="true"
                            value={loginSettings.hcaptchaSecretKey}
                            onChange={(event) => updateLoginSettingsForm({
                                hcaptchaSecretKey: event.target.value,
                                clearHcaptchaSecretKey: false
                            })}
                            placeholder={loginSettings.hcaptchaHasSecretKey ? '저장된 값 유지' : 'hCaptcha Secret Key'}
                            helperText={loginSettings.hcaptchaHasSecretKey ? '새 값을 입력하지 않으면 기존 secret을 유지합니다.' : undefined}
                        />
                    </div>

                    {loginSettings.hcaptchaHasSecretKey && (
                        <Checkbox
                            checked={loginSettings.clearHcaptchaSecretKey}
                            disabled={updateMutation.isPending}
                            onCheckedChange={(checked) => updateLoginSettingsForm({
                                clearHcaptchaSecretKey: checked,
                                hcaptchaSecretKey: checked ? '' : loginSettings.hcaptchaSecretKey
                            })}
                            label="저장된 hCaptcha Secret Key 삭제"
                            description="삭제 후 hCaptcha를 계속 사용하려면 새 Secret Key를 입력해야 합니다."
                        />
                    )}
                </div>
            </Card>

            <Card
                title="소셜 로그인"
                subtitle="OAuth 앱의 사용 여부와 앱 키를 관리합니다."
                icon={<i className="fas fa-right-to-bracket" />}>
                <div className="space-y-6">
                    <div className="rounded-lg bg-surface-subtle p-4 text-sm leading-relaxed text-content-secondary">
                        콜백 URL은 <code className="rounded-md bg-surface px-2 py-1 text-xs">/login/callback/provider</code> 형식으로 등록합니다.
                    </div>

                    {socialAuthProviders.map((provider) => (
                        <div key={provider.key} className="space-y-5 rounded-xl border border-line p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <div className="text-sm font-semibold text-content">{provider.name}</div>
                                    <p className="mt-1 text-xs text-content-secondary">
                                        콜백 URL: /login/callback/{provider.key}
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
                                    name={`blex_${provider.key}_oauth_public_value`}
                                    autoComplete="off"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    data-1p-ignore="true"
                                    data-bwignore="true"
                                    data-lpignore="true"
                                    placeholder={`${provider.name} OAuth Client ID`}
                                    value={provider.clientId}
                                    onChange={(event) => updateSocialProvider(provider.key, { clientId: event.target.value })}
                                />
                                <Input
                                    label="Client Secret"
                                    type="password"
                                    name={`blex_${provider.key}_oauth_private_value`}
                                    autoComplete="new-password"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    data-1p-ignore="true"
                                    data-bwignore="true"
                                    data-lpignore="true"
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
                                <Checkbox
                                    checked={provider.clearClientSecret}
                                    disabled={updateMutation.isPending}
                                    onCheckedChange={(checked) => updateSocialProvider(provider.key, {
                                        clearClientSecret: checked,
                                        clientSecret: checked ? '' : provider.clientSecret
                                    })}
                                    label="저장된 Client Secret 삭제"
                                />
                            )}
                        </div>
                    ))}
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
                    {updateMutation.isPending ? '저장 중...' : '로그인 관리 저장'}
                </Button>
            </div>
        </form>
    );
};

export default LoginSetting;
