import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { toast } from '~/utils/toast';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { SettingsHeader } from '../../components';
import { Button, Card, Input } from '~/components/shared';
import { CodeEditor } from '~/components/CodeEditor';
import { useConfirm } from '~/hooks/useConfirm';
import {
    deleteBrandAsset,
    getSiteSettings,
    updateSiteSettings,
    uploadBrandAsset,
    type BrandAssetTheme,
    type BrandAssetType,
    type SiteSettingData,
    type SiteSettingUpdateData,
    type SocialAuthProviderSetting
} from '~/lib/api/settings';
import {
    createIconBrandAssetFormData,
    createSvgBrandAssetFormData
} from './brandAssetGenerator';

interface BrandAssetUploadPayload {
    assetType: BrandAssetType;
    theme: BrandAssetTheme;
    file: File;
}

interface BrandAssetDeletePayload {
    assetType: BrandAssetType;
    theme: BrandAssetTheme;
}

interface SocialAuthProviderForm extends SocialAuthProviderSetting {
    clientSecret: string;
    clearClientSecret: boolean;
}

interface AssetUploadButtonProps {
    label: string;
    disabled: boolean;
    onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
}

interface BrandAssetPanelProps {
    title: string;
    description: string;
    assetType: BrandAssetType;
    defaultUrl: string;
    darkUrl: string;
    hasDefaultAsset: boolean;
    hasDarkAsset: boolean;
    darkUploadDisabled: boolean;
    isPending: boolean;
    previewShape: 'logo' | 'icon';
    onUpload: (assetType: BrandAssetType, theme: BrandAssetTheme) => (event: ChangeEvent<HTMLInputElement>) => void;
    onDelete: (assetType: BrandAssetType, theme: BrandAssetTheme) => void;
}

interface BrandAssetSlotProps {
    label: string;
    url: string;
    shape: 'logo' | 'icon';
    dark?: boolean;
    hasAsset: boolean;
    uploadDisabled: boolean;
    deleteDisabled: boolean;
    onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
    onDelete: () => void;
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

const syncSettingsDocumentTitle = (siteName: string) => {
    const [titlePrefix] = document.title.split('|');
    document.title = `${titlePrefix?.trim() || '설정'} | ${siteName}`;
};

const AssetUploadButton = ({ label, disabled, onUpload }: AssetUploadButtonProps) => {
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <>
            <input
                ref={inputRef}
                type="file"
                accept=".svg,image/svg+xml"
                className="hidden"
                onChange={onUpload}
            />
            <Button
                variant="secondary"
                size="sm"
                disabled={disabled}
                leftIcon={<i className="fas fa-upload text-xs" />}
                onClick={() => inputRef.current?.click()}>
                {label}
            </Button>
        </>
    );
};

const BrandAssetSlot = ({
    label,
    url,
    shape,
    dark = false,
    hasAsset,
    uploadDisabled,
    deleteDisabled,
    onUpload,
    onDelete
}: BrandAssetSlotProps) => (
    <div className="space-y-3 rounded-lg border border-line bg-surface p-3">
        <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold text-content-secondary">{label}</div>
            <div className="text-[11px] font-medium text-content-hint">
                {hasAsset ? '커스텀' : '기본값'}
            </div>
        </div>
        <div
            data-theme={dark ? 'dark' : 'light'}
            className="flex h-24 items-center justify-center rounded-xl border border-line bg-surface-subtle p-4">
            <img
                src={url}
                alt=""
                className={shape === 'icon' ? 'h-14 w-14 object-contain' : 'max-h-12 max-w-full object-contain'}
            />
        </div>
        <div className="flex flex-wrap items-center gap-2">
            <AssetUploadButton
                label="업로드"
                disabled={uploadDisabled}
                onUpload={onUpload}
            />
            {hasAsset && (
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={deleteDisabled}
                    className="text-danger hover:text-danger"
                    onClick={onDelete}>
                    삭제
                </Button>
            )}
        </div>
    </div>
);

const BrandAssetPanel = ({
    title,
    description,
    assetType,
    defaultUrl,
    darkUrl,
    hasDefaultAsset,
    hasDarkAsset,
    darkUploadDisabled,
    isPending,
    previewShape,
    onUpload,
    onDelete
}: BrandAssetPanelProps) => (
    <section className="space-y-4 rounded-xl border border-line bg-surface-subtle p-4">
        <div className="space-y-1">
            <h4 className="text-sm font-semibold text-content">{title}</h4>
            <p className="text-xs leading-relaxed text-content-secondary">{description}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
            <BrandAssetSlot
                label="기본"
                url={defaultUrl}
                shape={previewShape}
                hasAsset={hasDefaultAsset}
                uploadDisabled={isPending}
                deleteDisabled={isPending}
                onUpload={onUpload(assetType, 'default')}
                onDelete={() => onDelete(assetType, 'default')}
            />
            <BrandAssetSlot
                label="다크 모드"
                url={darkUrl}
                shape={previewShape}
                dark
                hasAsset={hasDarkAsset}
                uploadDisabled={isPending || darkUploadDisabled}
                deleteDisabled={isPending}
                onUpload={onUpload(assetType, 'dark')}
                onDelete={() => onDelete(assetType, 'dark')}
            />
        </div>
    </section>
);

const SiteSettingSetting = () => {
    const queryClient = useQueryClient();
    const { confirm } = useConfirm();
    const hasHydratedFormRef = useRef(false);
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

    const [siteName, setSiteName] = useState('');
    const [headerScript, setHeaderScript] = useState('');
    const [footerScript, setFooterScript] = useState('');
    const [welcomeMessage, setWelcomeMessage] = useState('');
    const [welcomeUrl, setWelcomeUrl] = useState('');
    const [deletionRedirectUrl, setDeletionRedirectUrl] = useState('');
    const [socialAuthProviders, setSocialAuthProviders] = useState<SocialAuthProviderForm[]>([]);

    useEffect(() => {
        if (!hasHydratedFormRef.current) {
            setSiteName(settingData.siteName);
            setHeaderScript(settingData.headerScript);
            setFooterScript(settingData.footerScript);
            setWelcomeMessage(settingData.welcomeNotificationMessage);
            setWelcomeUrl(settingData.welcomeNotificationUrl);
            setDeletionRedirectUrl(settingData.accountDeletionRedirectUrl);
            setSocialAuthProviders(settingData.socialAuthProviders.map((provider) => ({
                ...provider,
                clientSecret: '',
                clearClientSecret: false
            })));
            hasHydratedFormRef.current = true;
        }
        syncSettingsDocumentTitle(settingData.siteName);
    }, [settingData]);

    const updateMutation = useMutation({
        mutationFn: async (data: SiteSettingUpdateData) => {
            const response = await updateSiteSettings(data);
            return assertDone(response, '사이트 설정 저장에 실패했습니다.');
        },
        onSuccess: (body: SiteSettingData) => {
            setSiteName(body.siteName);
            setHeaderScript(body.headerScript);
            setFooterScript(body.footerScript);
            setWelcomeMessage(body.welcomeNotificationMessage);
            setWelcomeUrl(body.welcomeNotificationUrl);
            setDeletionRedirectUrl(body.accountDeletionRedirectUrl);
            setSocialAuthProviders(body.socialAuthProviders.map((provider) => ({
                ...provider,
                clientSecret: '',
                clearClientSecret: false
            })));
            syncSettingsDocumentTitle(body.siteName);
            void queryClient.invalidateQueries({ queryKey: ['site-settings'] });
            toast.success('사이트 설정이 저장되었습니다.');
        },
        onError: (error) => {
            toast.error(getErrorMessage(error, '사이트 설정 저장에 실패했습니다.'));
        }
    });

    const uploadMutation = useMutation({
        mutationFn: async ({ assetType, theme, file }: BrandAssetUploadPayload) => {
            const formData = assetType === 'icon' && theme === 'default'
                ? await createIconBrandAssetFormData(file)
                : createSvgBrandAssetFormData(assetType, theme, file);
            const response = await uploadBrandAsset(formData);
            return assertDone(response, '브랜드 자산 저장에 실패했습니다.');
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['site-settings'] });
            toast.success('브랜드 자산이 저장되었습니다.');
        },
        onError: (error) => {
            toast.error(getErrorMessage(error, '브랜드 자산 저장에 실패했습니다.'));
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async ({ assetType, theme }: BrandAssetDeletePayload) => {
            const response = await deleteBrandAsset(assetType, theme);
            return assertDone(response, '브랜드 자산 삭제에 실패했습니다.');
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['site-settings'] });
            toast.success('브랜드 자산이 삭제되었습니다.');
        },
        onError: (error) => {
            toast.error(getErrorMessage(error, '브랜드 자산 삭제에 실패했습니다.'));
        }
    });

    const handleSave = () => {
        updateMutation.mutate({
            site_name: siteName,
            header_script: headerScript,
            footer_script: footerScript,
            welcome_notification_message: welcomeMessage,
            welcome_notification_url: welcomeUrl,
            account_deletion_redirect_url: deletionRedirectUrl,
            social_auth_providers: socialAuthProviders.map((provider) => ({
                key: provider.key,
                is_enabled: provider.isEnabled,
                client_id: provider.clientId,
                ...(provider.clientSecret ? { client_secret: provider.clientSecret } : {}),
                ...(provider.clearClientSecret ? { clear_client_secret: true } : {})
            }))
        });
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

    const handleBrandAssetUpload = (assetType: BrandAssetType, theme: BrandAssetTheme) => (
        event: ChangeEvent<HTMLInputElement>
    ) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) {
            return;
        }
        uploadMutation.mutate({
            assetType,
            theme,
            file
        });
    };

    const handleBrandAssetDelete = async (assetType: BrandAssetType, theme: BrandAssetTheme) => {
        const title = theme === 'default'
            ? (
                assetType === 'icon'
                    ? '기본 아이콘 삭제'
                    : '기본 로고 삭제'
            )
            : '다크 모드 자산 삭제';
        const message = theme === 'default'
            ? (
                assetType === 'icon'
                    ? '기본 아이콘을 삭제하면 다크 아이콘, favicon, PNG 아이콘도 함께 삭제됩니다. 계속할까요?'
                    : '기본 로고를 삭제하면 다크 모드 로고도 함께 삭제됩니다. 계속할까요?'
            )
            : '다크 모드 자산을 삭제할까요?';
        const confirmed = await confirm({
            title,
            message,
            confirmText: '삭제',
            variant: 'danger'
        });
        if (!confirmed) {
            return;
        }

        deleteMutation.mutate({
            assetType,
            theme
        });
    };

    const assetMutationPending = uploadMutation.isPending || deleteMutation.isPending;

    return (
        <div className="space-y-8">
            <SettingsHeader
                title="사이트 설정"
                description="사이트 이름, 브랜드 자산, 전역 코드 및 알림 설정을 관리합니다."
            />

            <Card
                title="브랜드"
                subtitle="공개 화면, RSS, llms.txt, favicon에 쓰이는 사이트 이름과 브랜드 자산입니다."
                icon={<i className="fas fa-building" />}>
                <div className="space-y-6">
                    <div>
                        <Input
                            label="사이트 이름"
                            maxLength={80}
                            placeholder="BLEX"
                            value={siteName}
                            onChange={(event) => setSiteName(event.target.value)}
                            helperText="브라우저 제목, RSS, 검색 결과, 공개 문서에 표시됩니다."
                        />
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                        <BrandAssetPanel
                            title="로고"
                            description="헤더와 푸터에 쓰입니다. 다크 모드 SVG는 기본 로고를 올린 뒤 선택적으로 지정합니다."
                            assetType="logo"
                            defaultUrl={settingData.logoSvgUrl}
                            darkUrl={settingData.logoSvgDarkUrl}
                            hasDefaultAsset={settingData.hasCustomLogo}
                            hasDarkAsset={settingData.hasCustomLogoDark}
                            darkUploadDisabled={!settingData.hasCustomLogo}
                            isPending={assetMutationPending}
                            previewShape="logo"
                            onUpload={handleBrandAssetUpload}
                            onDelete={handleBrandAssetDelete}
                        />
                        <BrandAssetPanel
                            title="아이콘"
                            description="기본 아이콘 SVG를 올리면 브라우저에서 favicon과 PNG 아이콘을 함께 생성합니다."
                            assetType="icon"
                            defaultUrl={settingData.iconSvgUrl}
                            darkUrl={settingData.iconSvgDarkUrl}
                            hasDefaultAsset={settingData.hasCustomIcon}
                            hasDarkAsset={settingData.hasCustomIconDark}
                            darkUploadDisabled={!settingData.hasCustomIcon}
                            isPending={assetMutationPending}
                            previewShape="icon"
                            onUpload={handleBrandAssetUpload}
                            onDelete={handleBrandAssetDelete}
                        />
                    </div>
                </div>
            </Card>

            <Card
                title="커스텀 코드"
                subtitle="스크립트나 메타 태그와 같은 코드를 전역에 삽입할 수 있습니다."
                icon={<i className="fas fa-code" />}>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-content">
                            Head 영역 코드
                        </label>
                        <CodeEditor
                            language="html"
                            value={headerScript}
                            onChange={setHeaderScript}
                            height="200px"
                        />
                        <p className="text-xs text-content-secondary">{'<head>'} 태그 안에 삽입됩니다.</p>
                    </div>
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-content">
                            Body 하단 코드
                        </label>
                        <CodeEditor
                            language="html"
                            value={footerScript}
                            onChange={setFooterScript}
                            height="200px"
                        />
                        <p className="text-xs text-content-secondary">{'</body>'} 태그 직전에 삽입됩니다.</p>
                    </div>
                </div>
            </Card>

            <Card
                title="소셜 로그인"
                subtitle="설치형 블로그에서 사용할 OAuth 제공자를 설정합니다. 현재 Google과 GitHub를 지원합니다."
                icon={<i className="fas fa-right-to-bracket" />}>
                <div className="space-y-4">
                    {socialAuthProviders.map((provider) => (
                        <div
                            key={provider.key}
                            className="rounded-2xl border border-line bg-surface-subtle p-4 space-y-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h3 className="font-semibold text-content">{provider.name}</h3>
                                    <p className="text-xs text-content-secondary">
                                        콜백 URL: /login/callback/{provider.key}
                                    </p>
                                </div>
                                <label className="inline-flex items-center gap-2 text-sm font-semibold text-content">
                                    <input
                                        type="checkbox"
                                        checked={provider.isEnabled}
                                        onChange={(event) => updateSocialProvider(provider.key, { isEnabled: event.target.checked })}
                                    />
                                    사용
                                </label>
                            </div>
                            <div className="grid gap-4 lg:grid-cols-2">
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
                                <label className="inline-flex items-center gap-2 text-xs text-content-secondary">
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
                    ))}
                </div>
            </Card>

            <Card
                title="회원가입 알림"
                subtitle="새로운 회원 가입 시 발송되는 환영 알림을 설정합니다."
                icon={<i className="fas fa-bell" />}>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-content">
                            환영 메시지
                        </label>
                        <Input
                            multiline
                            rows={3}
                            placeholder="환영합니다, {name}님! BLEX에 오신 것을 환영합니다."
                            value={welcomeMessage}
                            onChange={(e) => setWelcomeMessage(e.target.value)}
                            className="text-sm"
                        />
                        <p className="text-xs text-content-secondary">{'{name}'}을 사용하면 사용자 이름으로 치환됩니다.</p>
                    </div>
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-content">
                            알림 클릭 URL
                        </label>
                        <Input
                            placeholder="/"
                            value={welcomeUrl}
                            onChange={(e) => setWelcomeUrl(e.target.value)}
                            className="text-sm"
                        />
                        <p className="text-xs text-content-secondary">환영 알림 클릭 시 이동할 URL입니다.</p>
                    </div>
                </div>
            </Card>

            <Card
                title="회원 탈퇴 설정"
                subtitle="회원 탈퇴 시 리다이렉트 설정입니다."
                icon={<i className="fas fa-user-minus" />}>
                <div className="space-y-2">
                    <label className="block text-sm font-semibold text-content">
                        탈퇴 후 리다이렉트 URL
                    </label>
                    <Input
                        placeholder="https://forms.example.com/exit-survey"
                        value={deletionRedirectUrl}
                        onChange={(e) => setDeletionRedirectUrl(e.target.value)}
                        className="text-sm"
                    />
                    <p className="text-xs text-content-secondary">비워두면 메인 페이지로 이동합니다. 설문 링크 등을 설정할 수 있습니다.</p>
                </div>
            </Card>

            <div className="flex justify-end">
                <Button
                    variant="primary"
                    size="md"
                    isLoading={updateMutation.isPending}
                    disabled={assetMutationPending}
                    onClick={handleSave}
                    leftIcon={!updateMutation.isPending ? <i className="fas fa-check" /> : undefined}>
                    {updateMutation.isPending ? '저장 중...' : '저장'}
                </Button>
            </div>
        </div>
    );
};

export default SiteSettingSetting;
