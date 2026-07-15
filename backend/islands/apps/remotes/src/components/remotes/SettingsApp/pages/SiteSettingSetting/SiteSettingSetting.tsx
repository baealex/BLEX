import {
    type ChangeEvent,
    type FormEvent,
    useEffect,
    useRef,
    useState
} from 'react';
import { toast } from '~/utils/toast';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import {
    AlertTriangle,
    Check,
    ChevronDown,
    Code2,
    Image,
    Palette,
    Upload
} from '@blex/ui/icons';
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
    type SiteSettingUpdateData
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

interface EditableSiteSettings {
    siteName: string;
    headerScript: string;
    footerScript: string;
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

const getEditableSiteSettings = (data: SiteSettingData): EditableSiteSettings => ({
    siteName: data.siteName,
    headerScript: data.headerScript,
    footerScript: data.footerScript
});

const hasSiteSettingsChanged = (current: EditableSiteSettings, saved: EditableSiteSettings | null) => {
    if (!saved) return false;

    return Object.keys(current).some((key) => (
        current[key as keyof EditableSiteSettings] !== saved[key as keyof EditableSiteSettings]
    ));
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
                density="compact"
                variant="secondary"
                size="sm"
                className="h-11 flex-1 [@media(pointer:fine)]:h-9 sm:flex-none"
                disabled={disabled}
                leftIcon={<Upload aria-hidden="true" className="h-3.5 w-3.5" />}
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
    <div className="space-y-3 rounded-xl bg-surface-subtle p-4">
        <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold text-content-secondary">{label}</div>
            <div className="text-[11px] font-medium text-content-hint">
                {hasAsset ? '커스텀' : '기본값'}
            </div>
        </div>
        <div
            data-theme={dark ? 'dark' : 'light'}
            className="flex h-24 items-center justify-center rounded-xl bg-surface p-4">
            <img
                src={url}
                alt=""
                className={shape === 'icon' ? 'h-14 w-14 object-contain' : 'max-h-12 max-w-full object-contain'}
            />
        </div>
        <div className="flex items-center gap-2">
            <AssetUploadButton
                label="업로드"
                disabled={uploadDisabled}
                onUpload={onUpload}
            />
            {hasAsset && (
                <Button
                    density="compact"
                    variant="danger"
                    size="sm"
                    disabled={deleteDisabled}
                    className="h-11 flex-1 [@media(pointer:fine)]:h-9 sm:flex-none"
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
    <Card
        title={title}
        subtitle={description}
        icon={assetType === 'logo'
            ? <Image aria-hidden="true" className="h-4 w-4" />
            : <Palette aria-hidden="true" className="h-4 w-4" />}>
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
    </Card>
);

const SiteSettingSetting = () => {
    const queryClient = useQueryClient();
    const { confirm } = useConfirm();
    const hasHydratedFormRef = useRef(false);
    const savedSettingsRef = useRef<EditableSiteSettings | null>(null);
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
    const [isGlobalCodeOpen, setIsGlobalCodeOpen] = useState(
        Boolean(settingData.headerScript || settingData.footerScript)
    );

    useEffect(() => {
        if (!hasHydratedFormRef.current) {
            const editableSettings = getEditableSiteSettings(settingData);
            setSiteName(editableSettings.siteName);
            setHeaderScript(editableSettings.headerScript);
            setFooterScript(editableSettings.footerScript);
            savedSettingsRef.current = editableSettings;
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
            const editableSettings = getEditableSiteSettings(body);
            setSiteName(editableSettings.siteName);
            setHeaderScript(editableSettings.headerScript);
            setFooterScript(editableSettings.footerScript);
            savedSettingsRef.current = editableSettings;
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

    const handleSave = (event?: FormEvent<HTMLFormElement>) => {
        event?.preventDefault();
        updateMutation.mutate({
            site_name: siteName,
            header_script: headerScript,
            footer_script: footerScript
        });
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
    const currentSettings: EditableSiteSettings = {
        siteName,
        headerScript,
        footerScript
    };
    const isDirty = hasSiteSettingsChanged(currentSettings, savedSettingsRef.current);
    const isGlobalCodeDirty = savedSettingsRef.current !== null && (
        headerScript !== savedSettingsRef.current.headerScript
        || footerScript !== savedSettingsRef.current.footerScript
    );
    const hasGlobalCode = Boolean(headerScript.trim() || footerScript.trim());
    const globalCodeStatus = isGlobalCodeDirty
        ? '저장하지 않은 변경이 있습니다.'
        : hasGlobalCode
            ? '현재 모든 공개 페이지에 적용 중입니다.'
            : '현재 설정된 코드가 없습니다.';
    const saveDisabled = !isDirty || assetMutationPending || updateMutation.isPending;

    return (
        <form className="space-y-8" onSubmit={handleSave}>
            <SettingsHeader title="블로그 커스텀" />

            <section className="space-y-4" aria-labelledby="basic-site-settings-title">
                <h2 id="basic-site-settings-title" className="text-base font-semibold text-content">
                    기본 설정
                </h2>
                <Card>
                    <Input
                        density="compact"
                        label="사이트 이름"
                        maxLength={80}
                        placeholder="BLEX"
                        value={siteName}
                        onChange={(event) => setSiteName(event.target.value)}
                        helperText="브라우저 제목, 검색 결과, RSS와 공개 문서에 표시됩니다."
                    />
                </Card>

                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <h3 className="text-sm font-semibold text-content">브랜드 자산</h3>
                    <p className="text-xs text-content-secondary">업로드와 삭제는 별도 저장 없이 즉시 반영됩니다.</p>
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
            </section>

            <section className="space-y-4" aria-labelledby="advanced-site-settings-title">
                <h2 id="advanced-site-settings-title" className="text-base font-semibold text-content">
                    고급 설정
                </h2>
                <details
                    className="group overflow-hidden rounded-2xl bg-surface ring-1 ring-line/60"
                    open={isGlobalCodeOpen}
                    onToggle={(event) => setIsGlobalCodeOpen(event.currentTarget.open)}>
                    <summary className="flex min-h-20 cursor-pointer list-none items-center gap-4 px-6 py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-strong md:px-8 [&::-webkit-details-marker]:hidden">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-surface text-warning">
                            <Code2 aria-hidden="true" className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-base font-semibold text-content">전역 코드</span>
                            <span
                                aria-live="polite"
                                className={`mt-1 block text-sm ${isGlobalCodeDirty ? 'text-warning' : 'text-content-secondary'}`}>
                                {globalCodeStatus}
                            </span>
                        </span>
                        <ChevronDown
                            aria-hidden="true"
                            className="h-5 w-5 shrink-0 text-content-hint transition-transform group-open:rotate-180 motion-reduce:transition-none"
                        />
                    </summary>

                    {isGlobalCodeOpen && (
                        <div className="space-y-6 border-t border-line px-6 py-6 md:px-8 md:py-8">
                            <div className="flex gap-3 rounded-xl border border-warning-line bg-warning-surface p-4 text-warning">
                                <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                                <p className="text-xs leading-relaxed">
                                    저장 즉시 모든 공개 페이지에 적용됩니다. 메타 태그와 먼저 불러올 코드는 {'<head>'} 안에,
                                    나중에 불러올 스크립트는 {'</body>'} 직전에 삽입되므로 검증된 코드만 사용하세요.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <div className="block text-sm font-semibold text-content">
                                    Head 영역 코드
                                </div>
                                <CodeEditor
                                    ariaLabel="Head 영역 코드"
                                    language="html"
                                    value={headerScript}
                                    onChange={setHeaderScript}
                                    height="220px"
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="block text-sm font-semibold text-content">
                                    Body 하단 코드
                                </div>
                                <CodeEditor
                                    ariaLabel="Body 하단 코드"
                                    language="html"
                                    value={footerScript}
                                    onChange={setFooterScript}
                                    height="220px"
                                />
                            </div>
                        </div>
                    )}
                </details>
            </section>

            <div className="sticky bottom-0 z-10 -mx-4 flex justify-end bg-surface-page/95 px-4 py-3 backdrop-blur md:mx-0 md:px-0">
                <Button
                    density="compact"
                    type="submit"
                    variant="primary"
                    size="md"
                    className="h-11 w-full [@media(pointer:fine)]:h-10 sm:w-auto"
                    isLoading={updateMutation.isPending}
                    disabled={saveDisabled}
                    leftIcon={!updateMutation.isPending
                        ? <Check aria-hidden="true" className="h-4 w-4" />
                        : undefined}>
                    {updateMutation.isPending ? '저장 중...' : '사이트 설정 저장'}
                </Button>
            </div>
        </form>
    );
};

export default SiteSettingSetting;
