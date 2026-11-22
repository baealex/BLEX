import { type FormEvent, useEffect, useRef, useState } from 'react';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import {
    Check,
    ChevronDown,
    KeyRound,
    LogIn,
    ShieldCheck,
    UserCog
} from '@blex/ui/icons';
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

const getProviderCredentialState = (provider: SocialAuthProviderForm) => {
    const hasClientId = provider.clientId.trim().length > 0;
    const hasClientSecret = !provider.clearClientSecret && (
        provider.hasClientSecret || provider.clientSecret.trim().length > 0
    );

    return {
        hasClientId,
        hasClientSecret,
        isComplete: hasClientId && hasClientSecret
    };
};

const getProviderCredentialStatus = (provider: SocialAuthProviderForm) => {
    const { hasClientId, hasClientSecret, isComplete } = getProviderCredentialState(provider);
    if (isComplete) {
        return msg({
            id: 'settings.login.social.credentials.complete',
            message: 'Client ID and secret configured'
        });
    }
    if (hasClientId || hasClientSecret) {
        return msg({
            id: 'settings.login.social.credentials.partial',
            message: 'Some app credentials configured'
        });
    }
    return msg({
        id: 'settings.login.social.credentials.missing',
        message: 'App credentials not configured'
    });
};

interface ProviderAvailabilityStatus {
    label: MessageDescriptor;
    className: string;
}

interface GetProviderAvailabilityStatusOptions {
    hasDraftChanges: boolean;
    isEnabled: boolean;
    wasAvailable: boolean;
    willBeAvailable: boolean;
}

const getProviderAvailabilityStatus = ({
    hasDraftChanges,
    isEnabled,
    wasAvailable,
    willBeAvailable
}: GetProviderAvailabilityStatusOptions): ProviderAvailabilityStatus => {
    if (hasDraftChanges) {
        if (!willBeAvailable && isEnabled) {
            return {
                label: msg({
                    id: 'settings.login.social.status.credentials_required',
                    message: 'App credentials required'
                }),
                className: 'bg-warning-surface text-warning'
            };
        }
        if (willBeAvailable && !wasAvailable) {
            return {
                label: msg({
                    id: 'settings.login.social.status.visible_after_save',
                    message: 'Visible after saving'
                }),
                className: 'bg-warning-surface text-warning'
            };
        }
        if (!willBeAvailable && wasAvailable) {
            return {
                label: msg({
                    id: 'settings.login.social.status.hidden_after_save',
                    message: 'Hidden after saving'
                }),
                className: 'bg-warning-surface text-warning'
            };
        }
        return {
            label: msg({
                id: 'settings.login.social.status.unsaved',
                message: 'Unsaved changes'
            }),
            className: 'bg-warning-surface text-warning'
        };
    }

    if (wasAvailable) {
        return {
            label: msg({
                id: 'settings.login.social.status.visible',
                message: 'Visible on login page'
            }),
            className: 'bg-success-surface text-success'
        };
    }
    if (isEnabled) {
        return {
            label: msg({
                id: 'settings.login.social.status.credentials_required',
                message: 'App credentials required'
            }),
            className: 'bg-warning-surface text-warning'
        };
    }
    return {
        label: msg({
            id: 'settings.login.social.status.disabled',
            message: 'Disabled'
        }),
        className: 'bg-surface-subtle text-content-secondary'
    };
};

interface ProviderCredentialFieldsProps {
    provider: SocialAuthProviderForm;
    isPending: boolean;
    onUpdate: (key: string, patch: Partial<SocialAuthProviderForm>) => void;
}

const ProviderCredentialFields = ({
    provider,
    isPending,
    onUpdate
}: ProviderCredentialFieldsProps) => {
    const { t } = useLingui();

    return (
        <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
                <Input
                    density="compact"
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
                    onChange={(event) => onUpdate(provider.key, { clientId: event.target.value })}
                />
                <Input
                    density="compact"
                    label="Client Secret"
                    type="password"
                    name={`blex_${provider.key}_oauth_private_value`}
                    autoComplete="new-password"
                    autoCorrect="off"
                    spellCheck={false}
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-lpignore="true"
                    placeholder={provider.hasClientSecret
                        ? t({
                            id: 'settings.login.secret.keep_placeholder',
                            message: 'Keep saved value'
                        })
                        : `${provider.name} OAuth Client Secret`}
                    value={provider.clientSecret}
                    onChange={(event) => onUpdate(provider.key, {
                        clientSecret: event.target.value,
                        clearClientSecret: false
                    })}
                    helperText={provider.hasClientSecret
                        ? t({
                            id: 'settings.login.secret.keep_help',
                            message: 'Leave this blank to keep the existing secret.'
                        })
                        : undefined}
                />
            </div>

            {provider.hasClientSecret && (
                <Checkbox
                    checked={provider.clearClientSecret}
                    disabled={isPending}
                    className="min-h-11 py-2"
                    onCheckedChange={(checked) => onUpdate(provider.key, {
                        clearClientSecret: checked,
                        clientSecret: checked ? '' : provider.clientSecret
                    })}
                    label={t({
                        id: 'settings.login.social.secret.delete',
                        message: 'Delete saved Client Secret'
                    })}
                />
            )}
        </div>
    );
};

interface SocialAuthProviderPanelProps {
    provider: SocialAuthProviderForm;
    savedProvider: SavedSocialAuthProviderForm | null;
    isPending: boolean;
    onUpdate: (key: string, patch: Partial<SocialAuthProviderForm>) => void;
}

const SocialAuthProviderPanel = ({
    provider,
    savedProvider,
    isPending,
    onUpdate
}: SocialAuthProviderPanelProps) => {
    const { i18n, t } = useLingui();
    const { isComplete } = getProviderCredentialState(provider);
    const wasAvailable = Boolean(
        savedProvider?.isEnabled
        && savedProvider.clientId.trim()
        && savedProvider.hasClientSecret
    );
    const willBeAvailable = provider.isEnabled && isComplete;
    const hasDraftChanges = Boolean(savedProvider) && (
        provider.isEnabled !== savedProvider?.isEnabled
        || provider.clientId !== savedProvider?.clientId
        || provider.hasClientSecret !== savedProvider?.hasClientSecret
        || provider.clientSecret.trim().length > 0
        || provider.clearClientSecret
    );
    const status = getProviderAvailabilityStatus({
        hasDraftChanges,
        isEnabled: provider.isEnabled,
        wasAvailable,
        willBeAvailable
    });

    return (
        <section
            aria-labelledby={`provider-${provider.key}-title`}
            className="overflow-hidden rounded-xl border border-line">
            <div className="flex items-start justify-between gap-4 p-4 sm:p-5">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3
                            id={`provider-${provider.key}-title`}
                            className="text-sm font-semibold text-content">
                            {provider.name}
                        </h3>
                        <span
                            aria-live="polite"
                            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${status.className}`}>
                            {i18n._(status.label)}
                        </span>
                    </div>
                    <p className="mt-2 text-xs text-content-secondary">
                        {t({
                            id: 'settings.login.social.callback_url',
                            message: 'Callback URL'
                        })}: <code className="break-all font-mono">/login/callback/{provider.key}</code>
                    </p>
                </div>
                <Toggle
                    checked={provider.isEnabled}
                    disabled={isPending}
                    onCheckedChange={(checked) => onUpdate(provider.key, { isEnabled: checked })}
                    aria-label={i18n._({
                        id: 'settings.login.social.enable_provider',
                        message: 'Enable {providerName} social login',
                        values: { providerName: provider.name }
                    })}
                />
            </div>

            {provider.isEnabled ? (
                <div className="space-y-4 border-t border-line p-4 sm:p-5">
                    {!isComplete && (
                        <p className="rounded-lg bg-warning-surface px-3 py-2 text-xs leading-relaxed text-warning">
                            {t({
                                id: 'settings.login.social.credentials_required_help',
                                message: 'Enter and save both the Client ID and Client Secret to show this provider on the login page.'
                            })}
                        </p>
                    )}
                    <ProviderCredentialFields
                        provider={provider}
                        isPending={isPending}
                        onUpdate={onUpdate}
                    />
                </div>
            ) : (
                <details className="group border-t border-line">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-strong sm:px-5 [&::-webkit-details-marker]:hidden">
                        <KeyRound aria-hidden="true" className="h-4 w-4 shrink-0 text-content-secondary" />
                        <span className="min-w-0 flex-1 font-semibold text-content">
                            {t({
                                id: 'settings.login.social.credentials.manage',
                                message: 'Manage app credentials'
                            })}
                        </span>
                        <span className="text-right text-xs text-content-secondary">
                            {i18n._(getProviderCredentialStatus(provider))}
                        </span>
                        <ChevronDown
                            aria-hidden="true"
                            className="h-4 w-4 shrink-0 text-content-hint transition-transform group-open:rotate-180 motion-reduce:transition-none"
                        />
                    </summary>
                    <div className="border-t border-line bg-surface-subtle/40 p-4 sm:p-5">
                        <ProviderCredentialFields
                            provider={provider}
                            isPending={isPending}
                            onUpdate={onUpdate}
                        />
                    </div>
                </details>
            )}
        </section>
    );
};

const LoginSetting = () => {
    const { i18n, t } = useLingui();
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
            throw new Error(t({
                id: 'settings.login.load_error',
                message: 'Failed to load login settings.'
            }));
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
            return assertDone(response, t({
                id: 'settings.login.save_error',
                message: 'Failed to save login settings.'
            }));
        },
        onSuccess: (body: LoginSettingData) => {
            const loginSettingsForm = toLoginSettingsForm(body);
            const providerForms = toSocialAuthProviderForms(body.socialAuthProviders);
            setLoginSettings(loginSettingsForm);
            setSocialAuthProviders(providerForms);
            savedLoginSettingsRef.current = toSavedLoginSettingsForm(loginSettingsForm);
            savedSocialAuthProvidersRef.current = toSavedSocialAuthProviderForms(providerForms);
            void queryClient.invalidateQueries({ queryKey: ['login-settings'] });
            toast.success(t({
                id: 'settings.login.save_success',
                message: 'Login settings saved.'
            }));
        },
        onError: (error) => {
            toast.error(getErrorMessage(error, t({
                id: 'settings.login.save_error',
                message: 'Failed to save login settings.'
            })));
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
    const prioritizedSocialAuthProviders = socialAuthProviders
        .map((provider, index) => {
            const savedProvider = savedSocialAuthProvidersRef.current?.find((item) => item.key === provider.key);
            const wasEnabled = savedProvider?.isEnabled ?? provider.isEnabled;
            const hadCompleteCredentials = Boolean(
                (savedProvider?.clientId ?? provider.clientId).trim()
                && (savedProvider?.hasClientSecret ?? provider.hasClientSecret)
            );
            const priority = wasEnabled && hadCompleteCredentials
                ? 0
                : wasEnabled
                    ? 1
                    : 2;
            return {
                provider,
                index,
                priority
            };
        })
        .sort((left, right) => left.priority - right.priority || left.index - right.index)
        .map(({ provider }) => provider);
    const availableSocialProviders = socialAuthProviders.filter((provider) => {
        const savedProvider = savedSocialAuthProvidersRef.current?.find((item) => item.key === provider.key);
        return Boolean(
            savedProvider?.isEnabled
            && savedProvider.clientId.trim()
            && savedProvider.hasClientSecret
        );
    });
    const hasEnabledSocialProvider = savedSocialAuthProvidersRef.current?.some((provider) => provider.isEnabled);
    const socialLoginSummary = availableSocialProviders.length > 0
        ? i18n._({
            id: 'settings.login.social.summary.visible',
            message: 'Available on the login page: {providers}.',
            values: { providers: availableSocialProviders.map((provider) => provider.name).join(', ') }
        })
        : hasEnabledSocialProvider
            ? t({
                id: 'settings.login.social.summary.credentials_required',
                message: 'Complete the app credentials for enabled providers to show them on the login page.'
            })
            : t({
                id: 'settings.login.social.summary.none',
                message: 'No social login providers are currently visible on the login page.'
            });

    return (
        <form className="space-y-8" onSubmit={handleSave} autoComplete="off">
            <SettingsHeader
                title={t({
                    id: 'settings.login.title',
                    message: 'Login settings'
                })}
            />

            <Card
                title={t({
                    id: 'settings.login.member_experience.title',
                    message: 'Member experience'
                })}
                icon={<UserCog aria-hidden="true" className="h-4 w-4" />}>
                <div className="space-y-4">
                    <Input
                        density="compact"
                        label={t({
                            id: 'settings.login.welcome_message.label',
                            message: 'Welcome message'
                        })}
                        multiline
                        rows={3}
                        placeholder={i18n._({
                            id: 'settings.login.welcome_message.placeholder',
                            message: 'Welcome, {name}! Thanks for joining BLEX.',
                            values: { name: '{name}' }
                        })}
                        value={loginSettings.welcomeMessage}
                        onChange={(event) => updateLoginSettingsForm({ welcomeMessage: event.target.value })}
                        helperText={i18n._({
                            id: 'settings.login.welcome_message.help',
                            message: '{name} is replaced with the member\'s username.',
                            values: { name: '{name}' }
                        })}
                    />
                    <Input
                        density="compact"
                        label={t({
                            id: 'settings.login.welcome_url.label',
                            message: 'Welcome notification URL'
                        })}
                        placeholder="/"
                        value={loginSettings.welcomeUrl}
                        onChange={(event) => updateLoginSettingsForm({ welcomeUrl: event.target.value })}
                    />
                    <Input
                        density="compact"
                        label={t({
                            id: 'settings.login.deletion_redirect_url.label',
                            message: 'Redirect URL after account deletion'
                        })}
                        placeholder="https://forms.example.com/exit-survey"
                        value={loginSettings.deletionRedirectUrl}
                        onChange={(event) => updateLoginSettingsForm({ deletionRedirectUrl: event.target.value })}
                        helperText={t({
                            id: 'settings.login.deletion_redirect_url.help',
                            message: 'Leave blank to redirect to the home page.'
                        })}
                    />
                </div>
            </Card>

            <Card
                title={t({
                    id: 'settings.login.social.title',
                    message: 'Social login'
                })}
                subtitle={socialLoginSummary}
                icon={<LogIn aria-hidden="true" className="h-4 w-4" />}>
                <div className="space-y-4">
                    {prioritizedSocialAuthProviders.map((provider) => (
                        <SocialAuthProviderPanel
                            key={provider.key}
                            provider={provider}
                            savedProvider={savedSocialAuthProvidersRef.current?.find((item) => item.key === provider.key) ?? null}
                            isPending={updateMutation.isPending}
                            onUpdate={updateSocialProvider}
                        />
                    ))}
                </div>
            </Card>

            <Card
                title={t({
                    id: 'settings.login.signup_protection.title',
                    message: 'Sign-up protection'
                })}
                icon={<ShieldCheck aria-hidden="true" className="h-4 w-4" />}>
                <div className="space-y-5">
                    <div className="flex items-start justify-between gap-4 border-b border-line pb-5">
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-content">
                                {t({
                                    id: 'settings.login.hcaptcha.enable',
                                    message: 'Use hCaptcha'
                                })}
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-content-secondary">
                                {t({
                                    id: 'settings.login.hcaptcha.enable_help',
                                    message: 'When enabled, sign-up requests must pass hCaptcha token verification.'
                                })}
                            </p>
                        </div>
                        <Toggle
                            checked={loginSettings.hcaptchaEnabled}
                            disabled={updateMutation.isPending}
                            onCheckedChange={(checked) => updateLoginSettingsForm({ hcaptchaEnabled: checked })}
                            aria-label={t({
                                id: 'settings.login.hcaptcha.enable',
                                message: 'Use hCaptcha'
                            })}
                        />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <Input
                            density="compact"
                            label={t({
                                id: 'settings.login.hcaptcha.site_key',
                                message: 'Site Key'
                            })}
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
                            density="compact"
                            label={t({
                                id: 'settings.login.hcaptcha.secret_key',
                                message: 'Secret Key'
                            })}
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
                            placeholder={loginSettings.hcaptchaHasSecretKey
                                ? t({
                                    id: 'settings.login.secret.keep_placeholder',
                                    message: 'Keep saved value'
                                })
                                : 'hCaptcha Secret Key'}
                            helperText={loginSettings.hcaptchaHasSecretKey
                                ? t({
                                    id: 'settings.login.secret.keep_help',
                                    message: 'Leave this blank to keep the existing secret.'
                                })
                                : undefined}
                        />
                    </div>

                    {loginSettings.hcaptchaHasSecretKey && (
                        <Checkbox
                            checked={loginSettings.clearHcaptchaSecretKey}
                            disabled={updateMutation.isPending}
                            className="min-h-11 py-2"
                            onCheckedChange={(checked) => updateLoginSettingsForm({
                                clearHcaptchaSecretKey: checked,
                                hcaptchaSecretKey: checked ? '' : loginSettings.hcaptchaSecretKey
                            })}
                            label={t({
                                id: 'settings.login.hcaptcha.secret.delete',
                                message: 'Delete saved hCaptcha Secret Key'
                            })}
                            description={t({
                                id: 'settings.login.hcaptcha.secret.delete_help',
                                message: 'To keep using hCaptcha after deleting it, enter a new Secret Key.'
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
                    className="h-11 w-full [@media(pointer:fine)]:h-10 sm:w-auto"
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
                            id: 'settings.login.save',
                            message: 'Save login settings'
                        })}
                </Button>
            </div>
        </form>
    );
};

export default LoginSetting;
