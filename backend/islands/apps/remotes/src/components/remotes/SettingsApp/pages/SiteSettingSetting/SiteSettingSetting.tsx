import {
    type ChangeEvent,
    type FormEvent,
    useEffect,
    useRef,
    useState
} from 'react';
import { useLingui } from '@lingui/react/macro';
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
    BrandAssetGenerationError,
    createIconBrandAssetFormData,
    createSvgBrandAssetFormData
} from './brandAssetGenerator';
import { getBrandAssetGenerationErrorMessage } from './brandAssetI18n';

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
    loadingLabel: string;
    disabled: boolean;
    isLoading: boolean;
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
    uploadingTheme: BrandAssetTheme | null;
    deletingTheme: BrandAssetTheme | null;
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
    isUploading: boolean;
    isDeleting: boolean;
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

const syncSettingsDocumentTitle = (siteName: string, fallbackTitle: string) => {
    const [titlePrefix] = document.title.split('|');
    document.title = `${titlePrefix?.trim() || fallbackTitle} | ${siteName}`;
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

const AssetUploadButton = ({
    label,
    loadingLabel,
    disabled,
    isLoading,
    onUpload
}: AssetUploadButtonProps) => {
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
                isLoading={isLoading}
                leftIcon={!isLoading ? <Upload aria-hidden="true" className="h-3.5 w-3.5" /> : undefined}
                onClick={() => inputRef.current?.click()}>
                {isLoading ? loadingLabel : label}
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
    isUploading,
    isDeleting,
    onUpload,
    onDelete
}: BrandAssetSlotProps) => {
    const { t } = useLingui();

    return (
        <div className="space-y-3 rounded-xl bg-surface-subtle p-4">
            <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-content-secondary">{label}</div>
                <div className="text-[11px] font-medium text-content-hint">
                    {hasAsset
                        ? t({
                            id: 'settings.site.brand.status.custom',
                            message: 'Custom'
                        })
                        : t({
                            id: 'settings.site.brand.status.default',
                            message: 'Default'
                        })}
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
                    label={t({
                        id: 'common.upload',
                        message: 'Upload'
                    })}
                    loadingLabel={t({
                        id: 'common.uploading',
                        message: 'Uploading...'
                    })}
                    disabled={uploadDisabled}
                    isLoading={isUploading}
                    onUpload={onUpload}
                />
                {hasAsset && (
                    <Button
                        density="compact"
                        variant="danger"
                        size="sm"
                        disabled={deleteDisabled}
                        isLoading={isDeleting}
                        className="h-11 flex-1 [@media(pointer:fine)]:h-9 sm:flex-none"
                        onClick={onDelete}>
                        {isDeleting
                            ? t({
                                id: 'common.deleting',
                                message: 'Deleting...'
                            })
                            : t({
                                id: 'common.delete',
                                message: 'Delete'
                            })}
                    </Button>
                )}
            </div>
        </div>
    );
};

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
    uploadingTheme,
    deletingTheme,
    previewShape,
    onUpload,
    onDelete
}: BrandAssetPanelProps) => {
    const { t } = useLingui();

    return (
        <Card
            title={title}
            subtitle={description}
            headingLevel={3}
            icon={assetType === 'logo'
                ? <Image aria-hidden="true" className="h-4 w-4" />
                : <Palette aria-hidden="true" className="h-4 w-4" />}>
            <div className="grid gap-3 sm:grid-cols-2">
                <BrandAssetSlot
                    label={t({
                        id: 'settings.site.brand.theme.default',
                        message: 'Default'
                    })}
                    url={defaultUrl}
                    shape={previewShape}
                    hasAsset={hasDefaultAsset}
                    uploadDisabled={isPending}
                    deleteDisabled={isPending}
                    isUploading={uploadingTheme === 'default'}
                    isDeleting={deletingTheme === 'default'}
                    onUpload={onUpload(assetType, 'default')}
                    onDelete={() => onDelete(assetType, 'default')}
                />
                <BrandAssetSlot
                    label={t({
                        id: 'settings.site.brand.theme.dark',
                        message: 'Dark mode'
                    })}
                    url={darkUrl}
                    shape={previewShape}
                    dark
                    hasAsset={hasDarkAsset}
                    uploadDisabled={isPending || darkUploadDisabled}
                    deleteDisabled={isPending}
                    isUploading={uploadingTheme === 'dark'}
                    isDeleting={deletingTheme === 'dark'}
                    onUpload={onUpload(assetType, 'dark')}
                    onDelete={() => onDelete(assetType, 'dark')}
                />
            </div>
        </Card>
    );
};

const SiteSettingSetting = () => {
    const { i18n, t } = useLingui();
    const queryClient = useQueryClient();
    const { confirm } = useConfirm();
    const settingsDocumentTitle = t({
        id: 'settings.document_title',
        message: 'Settings'
    });
    const hasHydratedFormRef = useRef(false);
    const savedSettingsRef = useRef<EditableSiteSettings | null>(null);
    const { data: settingData } = useSuspenseQuery({
        queryKey: ['site-settings'],
        queryFn: async () => {
            const { data } = await getSiteSettings();
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error(t({
                id: 'settings.site.load_error',
                message: 'Failed to load site settings.'
            }));
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
        syncSettingsDocumentTitle(settingData.siteName, settingsDocumentTitle);
    }, [settingData, settingsDocumentTitle]);

    const updateMutation = useMutation({
        mutationFn: async (data: SiteSettingUpdateData) => {
            const response = await updateSiteSettings(data);
            return assertDone(response, t({
                id: 'settings.site.save_error',
                message: 'Failed to save site settings.'
            }));
        },
        onSuccess: (body: SiteSettingData) => {
            const editableSettings = getEditableSiteSettings(body);
            setSiteName(editableSettings.siteName);
            setHeaderScript(editableSettings.headerScript);
            setFooterScript(editableSettings.footerScript);
            savedSettingsRef.current = editableSettings;
            syncSettingsDocumentTitle(body.siteName, settingsDocumentTitle);
            void queryClient.invalidateQueries({ queryKey: ['site-settings'] });
            toast.success(t({
                id: 'settings.site.save_success',
                message: 'Site settings saved.'
            }));
        },
        onError: (error) => {
            toast.error(getErrorMessage(error, t({
                id: 'settings.site.save_error',
                message: 'Failed to save site settings.'
            })));
        }
    });

    const uploadMutation = useMutation({
        mutationFn: async ({ assetType, theme, file }: BrandAssetUploadPayload) => {
            const formData = assetType === 'icon' && theme === 'default'
                ? await createIconBrandAssetFormData(file)
                : createSvgBrandAssetFormData(assetType, theme, file);
            const response = await uploadBrandAsset(formData);
            return assertDone(response, t({
                id: 'settings.site.brand.save_error',
                message: 'Failed to save the brand asset.'
            }));
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['site-settings'] });
            toast.success(t({
                id: 'settings.site.brand.save_success',
                message: 'Brand asset saved.'
            }));
        },
        onError: (error) => {
            const message = error instanceof BrandAssetGenerationError
                ? i18n._(getBrandAssetGenerationErrorMessage(error))
                : getErrorMessage(error, t({
                    id: 'settings.site.brand.save_error',
                    message: 'Failed to save the brand asset.'
                }));
            toast.error(message);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async ({ assetType, theme }: BrandAssetDeletePayload) => {
            const response = await deleteBrandAsset(assetType, theme);
            return assertDone(response, t({
                id: 'settings.site.brand.delete_error',
                message: 'Failed to delete the brand asset.'
            }));
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['site-settings'] });
            toast.success(t({
                id: 'settings.site.brand.delete_success',
                message: 'Brand asset deleted.'
            }));
        },
        onError: (error) => {
            toast.error(getErrorMessage(error, t({
                id: 'settings.site.brand.delete_error',
                message: 'Failed to delete the brand asset.'
            })));
        }
    });

    const handleSave = (event?: FormEvent<HTMLFormElement>) => {
        event?.preventDefault();
        updateMutation.mutate({
            site_name: siteName,
            ...(settingData.canManageScripts
                ? {
                    header_script: headerScript,
                    footer_script: footerScript
                }
                : {})
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
                    ? t({
                        id: 'settings.site.brand.delete.default_icon.title',
                        message: 'Delete default icon'
                    })
                    : t({
                        id: 'settings.site.brand.delete.default_logo.title',
                        message: 'Delete default logo'
                    })
            )
            : t({
                id: 'settings.site.brand.delete.dark.title',
                message: 'Delete dark mode asset'
            });
        const message = theme === 'default'
            ? (
                assetType === 'icon'
                    ? t({
                        id: 'settings.site.brand.delete.default_icon.message',
                        message: 'Deleting the default icon also deletes the dark icon, favicon, and PNG icons. Continue?'
                    })
                    : t({
                        id: 'settings.site.brand.delete.default_logo.message',
                        message: 'Deleting the default logo also deletes the dark mode logo. Continue?'
                    })
            )
            : t({
                id: 'settings.site.brand.delete.dark.message',
                message: 'Delete this dark mode asset?'
            });
        const confirmed = await confirm({
            title,
            message,
            confirmText: t({
                id: 'common.delete',
                message: 'Delete'
            }),
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
    const pendingUpload = uploadMutation.isPending ? uploadMutation.variables : null;
    const pendingDelete = deleteMutation.isPending ? deleteMutation.variables : null;
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
        ? t({
            id: 'settings.site.global_code.status.unsaved',
            message: 'You have unsaved changes.'
        })
        : hasGlobalCode
            ? t({
                id: 'settings.site.global_code.status.active',
                message: 'Currently active on all public pages.'
            })
            : t({
                id: 'settings.site.global_code.status.empty',
                message: 'No global code is currently configured.'
            });
    const saveDisabled = !isDirty || assetMutationPending || updateMutation.isPending;

    return (
        <form className="space-y-8" onSubmit={handleSave}>
            <SettingsHeader
                title={t({
                    id: 'settings.site.title',
                    message: 'Blog customization'
                })}
            />

            <section className="space-y-4" aria-labelledby="basic-site-settings-title">
                <h2 id="basic-site-settings-title" className="text-base font-semibold text-content">
                    {t({
                        id: 'settings.site.basic.title',
                        message: 'Basic settings'
                    })}
                </h2>
                <Card>
                    <Input
                        density="compact"
                        label={t({
                            id: 'settings.site.name.label',
                            message: 'Site name'
                        })}
                        maxLength={80}
                        placeholder="BLEX"
                        value={siteName}
                        onChange={(event) => setSiteName(event.target.value)}
                        helperText={t({
                            id: 'settings.site.name.help',
                            message: 'Shown in browser titles, search results, RSS, and public documents.'
                        })}
                    />
                </Card>
            </section>

            <section className="space-y-4" aria-labelledby="brand-assets-title">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <h2 id="brand-assets-title" className="text-base font-semibold text-content">
                        {t({
                            id: 'settings.site.brand.title',
                            message: 'Brand assets'
                        })}
                    </h2>
                    <p className="text-xs text-content-secondary">
                        {t({
                            id: 'settings.site.brand.immediate_help',
                            message: 'Uploads and deletions take effect immediately without a separate save.'
                        })}
                    </p>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                    <BrandAssetPanel
                        title={t({
                            id: 'settings.site.brand.logo.title',
                            message: 'Logo'
                        })}
                        description={t({
                            id: 'settings.site.brand.logo.description',
                            message: 'Used in the header and footer. After uploading the default logo, you can optionally add a dark mode SVG.'
                        })}
                        assetType="logo"
                        defaultUrl={settingData.logoSvgUrl}
                        darkUrl={settingData.logoSvgDarkUrl}
                        hasDefaultAsset={settingData.hasCustomLogo}
                        hasDarkAsset={settingData.hasCustomLogoDark}
                        darkUploadDisabled={!settingData.hasCustomLogo}
                        isPending={assetMutationPending}
                        uploadingTheme={pendingUpload?.assetType === 'logo' ? pendingUpload.theme : null}
                        deletingTheme={pendingDelete?.assetType === 'logo' ? pendingDelete.theme : null}
                        previewShape="logo"
                        onUpload={handleBrandAssetUpload}
                        onDelete={handleBrandAssetDelete}
                    />
                    <BrandAssetPanel
                        title={t({
                            id: 'settings.site.brand.icon.title',
                            message: 'Icon'
                        })}
                        description={t({
                            id: 'settings.site.brand.icon.description',
                            message: 'Uploading the default icon SVG also generates the favicon and PNG icons in your browser.'
                        })}
                        assetType="icon"
                        defaultUrl={settingData.iconSvgUrl}
                        darkUrl={settingData.iconSvgDarkUrl}
                        hasDefaultAsset={settingData.hasCustomIcon}
                        hasDarkAsset={settingData.hasCustomIconDark}
                        darkUploadDisabled={!settingData.hasCustomIcon}
                        isPending={assetMutationPending}
                        uploadingTheme={pendingUpload?.assetType === 'icon' ? pendingUpload.theme : null}
                        deletingTheme={pendingDelete?.assetType === 'icon' ? pendingDelete.theme : null}
                        previewShape="icon"
                        onUpload={handleBrandAssetUpload}
                        onDelete={handleBrandAssetDelete}
                    />
                </div>
            </section>

            {settingData.canManageScripts && (
                <section className="space-y-4" aria-labelledby="advanced-site-settings-title">
                    <h2 id="advanced-site-settings-title" className="text-base font-semibold text-content">
                        {t({
                            id: 'settings.site.advanced.title',
                            message: 'Advanced settings'
                        })}
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
                                <span className="block text-base font-semibold text-content">
                                    {t({
                                        id: 'settings.site.global_code.title',
                                        message: 'Global code'
                                    })}
                                </span>
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
                                        {i18n._({
                                            id: 'settings.site.global_code.warning',
                                            message: 'Saved code runs immediately on every public page. Meta tags and early-loading code are inserted inside {headTag}; later scripts are inserted just before {bodyTag}. Use only code you trust.',
                                            values: {
                                                headTag: '<head>',
                                                bodyTag: '</body>'
                                            }
                                        })}
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <div className="block text-sm font-semibold text-content">
                                        {t({
                                            id: 'settings.site.global_code.head',
                                            message: 'Head code'
                                        })}
                                    </div>
                                    <CodeEditor
                                        ariaLabel={t({
                                            id: 'settings.site.global_code.head',
                                            message: 'Head code'
                                        })}
                                        language="html"
                                        value={headerScript}
                                        onChange={setHeaderScript}
                                        height="220px"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="block text-sm font-semibold text-content">
                                        {t({
                                            id: 'settings.site.global_code.body_end',
                                            message: 'End-of-body code'
                                        })}
                                    </div>
                                    <CodeEditor
                                        ariaLabel={t({
                                            id: 'settings.site.global_code.body_end',
                                            message: 'End-of-body code'
                                        })}
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
            )}

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
                    {updateMutation.isPending
                        ? t({
                            id: 'common.saving_ellipsis',
                            message: 'Saving...'
                        })
                        : t({
                            id: 'settings.site.save',
                            message: 'Save site settings'
                        })}
                </Button>
            </div>
        </form>
    );
};

export default SiteSettingSetting;
