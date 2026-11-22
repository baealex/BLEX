import { useEffect, useMemo, useRef, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useNavigate, useBlocker } from '@tanstack/react-router';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { FloatingBottomBar } from '@blex/ui/floating-bottom-bar';
import { ArrowLeft, Send } from '@blex/ui/icons';
import { CodeEditor } from '~/components/CodeEditor';
import { Button, Checkbox, Input } from '~/components/shared';
import { useConfirm } from '~/hooks/useConfirm';
import { toast } from '~/utils/toast';
import { cx } from '~/lib/classnames';
import {
    getBanner,
    getGlobalBanner,
    createBanner,
    updateBanner,
    deleteBanner,
    createGlobalBanner,
    updateGlobalBanner,
    deleteGlobalBanner,
    type BannerCreateData,
    type BannerUpdateData,
    type GlobalBannerCreateData,
    type GlobalBannerUpdateData
} from '~/lib/api/settings';
import BannerPreviewFrame from './BannerPreviewFrame';
import {
    bannerPositionMessages,
    bannerPositionOptions,
    bannerTypeMessages,
    type BannerPosition,
    type BannerType
} from './bannerI18n';

type BannerScope = 'user' | 'global';
type BannerCreatePayload = BannerCreateData | GlobalBannerCreateData;
type BannerUpdatePayload = BannerUpdateData | GlobalBannerUpdateData;

interface BannerFormInputs {
    title: string;
    contentHtml: string;
    bannerType: BannerType;
    position: BannerPosition;
    isActive: boolean;
    order: number;
}

const defaultValues: BannerFormInputs = {
    title: '',
    contentHtml: '',
    bannerType: 'horizontal',
    position: 'top',
    isActive: true,
    order: 0
};

interface BannerEditorBaseProps {
    scope: BannerScope;
    bannerId?: number;
}

const BannerEditorBase = ({ scope, bannerId }: BannerEditorBaseProps) => {
    const { i18n, t } = useLingui();
    const isGlobal = scope === 'global';
    const isEditMode = bannerId !== undefined;
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { confirm } = useConfirm();
    const allowNavigationRef = useRef(false);
    const [hasSelectedPosition, setHasSelectedPosition] = useState(isEditMode);
    const bannerSchema = useMemo(() => z.object({
        title: z.string().trim()
            .min(1, t({
                id: 'settings.banners.validation.title_required',
                message: 'Enter a banner name.'
            }))
            .max(100, t({
                id: 'settings.banners.validation.title_max_length',
                message: 'Banner names must be 100 characters or fewer.'
            })),
        contentHtml: z.string().trim().min(1, t({
            id: 'settings.banners.validation.html_required',
            message: 'Enter banner HTML.'
        })),
        bannerType: z.enum(['horizontal', 'sidebar']),
        position: z.enum(['top', 'bottom', 'left', 'right']),
        isActive: z.boolean(),
        order: z.number().int().min(0, t({
            id: 'settings.banners.validation.order_min',
            message: 'Display order must be 0 or greater.'
        }))
    }), [t]);

    const { data: bannerDetail } = useSuspenseQuery({
        queryKey: [isGlobal ? 'global-banner-detail' : 'banner-detail', bannerId],
        queryFn: async () => {
            if (!bannerId) {
                return null;
            }

            const { data } = isGlobal ? await getGlobalBanner(bannerId) : await getBanner(bannerId);
            if (data.status === 'DONE') {
                return data.body;
            }

            throw new Error(data.errorMessage || i18n._({
                id: 'settings.banners.editor.load_failed',
                message: '{scope, select, global {Could not load the global banner.} other {Could not load the banner.}}',
                values: { scope }
            }));
        }
    });

    const {
        register,
        handleSubmit,
        control,
        watch,
        setValue,
        reset,
        formState: { errors, isDirty }
    } = useForm<BannerFormInputs>({
        resolver: zodResolver(bannerSchema),
        defaultValues
    });

    const navigateToList = (replace = false) => {
        if (isGlobal) {
            navigate({
                to: '/global-banners',
                replace
            });
            return;
        }

        navigate({
            to: '/banners',
            replace
        });
    };

    useEffect(() => {
        if (!bannerDetail) {
            reset(defaultValues);
            if (!isEditMode) {
                setHasSelectedPosition(false);
            }
            return;
        }

        reset({
            title: bannerDetail.title,
            contentHtml: bannerDetail.contentHtml,
            bannerType: bannerDetail.bannerType,
            position: bannerDetail.position,
            isActive: bannerDetail.isActive,
            order: bannerDetail.order
        });
        setHasSelectedPosition(true);
    }, [bannerDetail, isEditMode, reset]);

    useBlocker({
        shouldBlockFn: async () => {
            if (!isDirty || allowNavigationRef.current) return false;

            const confirmed = await confirm({
                title: t({
                    id: 'settings.banners.editor.unsaved.title',
                    message: 'Unsaved changes'
                }),
                message: t({
                    id: 'settings.banners.editor.unsaved.message',
                    message: 'Your changes have not been saved. Leave this page?'
                }),
                confirmText: t({
                    id: 'settings.banners.editor.unsaved.leave',
                    message: 'Leave'
                }),
                variant: 'danger'
            });
            return !confirmed;
        },
        enableBeforeUnload: () => isDirty && !allowNavigationRef.current
    });

    const invalidateQueries = () => {
        queryClient.invalidateQueries({ queryKey: [isGlobal ? 'global-banners' : 'banners'] });
        queryClient.invalidateQueries({ queryKey: [isGlobal ? 'global-banner-detail' : 'banner-detail'] });
    };

    const createMutation = useMutation({
        mutationFn: (payload: BannerCreatePayload) => (
            isGlobal
                ? createGlobalBanner(payload as GlobalBannerCreateData)
                : createBanner(payload as BannerCreateData)
        ),
        onSuccess: ({ data }) => {
            if (data.status === 'ERROR') {
                toast.error(data.errorMessage || i18n._({
                    id: 'settings.banners.create.failed',
                    message: '{scope, select, global {Could not create the global banner.} other {Could not create the banner.}}',
                    values: { scope }
                }));
                return;
            }

            toast.success(i18n._({
                id: 'settings.banners.create.success',
                message: '{scope, select, global {Global banner created.} other {Banner created.}}',
                values: { scope }
            }));
            invalidateQueries();
            allowNavigationRef.current = true;
            navigateToList(true);
        },
        onError: () => {
            toast.error(i18n._({
                id: 'settings.banners.create.failed',
                message: '{scope, select, global {Could not create the global banner.} other {Could not create the banner.}}',
                values: { scope }
            }));
        }
    });

    const updateMutation = useMutation({
        mutationFn: (payload: BannerUpdatePayload) => {
            if (!bannerId) {
                throw new Error('bannerId is required');
            }

            return isGlobal
                ? updateGlobalBanner(bannerId, payload as GlobalBannerUpdateData)
                : updateBanner(bannerId, payload as BannerUpdateData);
        },
        onSuccess: ({ data }) => {
            if (data.status === 'ERROR') {
                toast.error(data.errorMessage || i18n._({
                    id: 'settings.banners.update.failed',
                    message: '{scope, select, global {Could not update the global banner.} other {Could not update the banner.}}',
                    values: { scope }
                }));
                return;
            }

            toast.success(i18n._({
                id: 'settings.banners.update.success',
                message: '{scope, select, global {Global banner updated.} other {Banner updated.}}',
                values: { scope }
            }));
            invalidateQueries();
            allowNavigationRef.current = true;
            navigateToList(true);
        },
        onError: () => {
            toast.error(i18n._({
                id: 'settings.banners.update.failed',
                message: '{scope, select, global {Could not update the global banner.} other {Could not update the banner.}}',
                values: { scope }
            }));
        }
    });

    const deleteMutation = useMutation({
        mutationFn: () => {
            if (!bannerId) {
                throw new Error('bannerId is required');
            }

            return isGlobal ? deleteGlobalBanner(bannerId) : deleteBanner(bannerId);
        },
        onSuccess: ({ data }) => {
            if (data.status === 'ERROR') {
                toast.error(data.errorMessage || i18n._({
                    id: 'settings.banners.delete.failed',
                    message: '{scope, select, global {Could not delete the global banner.} other {Could not delete the banner.}}',
                    values: { scope }
                }));
                return;
            }

            toast.success(i18n._({
                id: 'settings.banners.delete.success',
                message: '{scope, select, global {Global banner deleted.} other {Banner deleted.}}',
                values: { scope }
            }));
            invalidateQueries();
            allowNavigationRef.current = true;
            navigateToList(true);
        },
        onError: () => {
            toast.error(i18n._({
                id: 'settings.banners.delete.failed',
                message: '{scope, select, global {Could not delete the global banner.} other {Could not delete the banner.}}',
                values: { scope }
            }));
        }
    });

    const bannerType = watch('bannerType');
    const position = watch('position');
    const title = watch('title');
    const contentHtml = watch('contentHtml');
    const isActive = watch('isActive');

    const handleDelete = async () => {
        const confirmMessage = title
            ? i18n._({
                id: 'settings.banners.editor.delete.confirm_named',
                message: 'Delete banner “{title}”?\n\nThis action cannot be undone.',
                values: { title }
            })
            : t({
                id: 'settings.banners.editor.delete.confirm',
                message: 'Delete this banner?\n\nThis action cannot be undone.'
            });

        const confirmed = await confirm({
            title: i18n._({
                id: 'settings.banners.delete.title',
                message: '{scope, select, global {Delete global banner} other {Delete banner}}',
                values: { scope }
            }),
            message: confirmMessage,
            confirmText: t({
                id: 'common.delete',
                message: 'Delete'
            }),
            variant: 'danger'
        });

        if (!confirmed) {
            return;
        }

        deleteMutation.mutate();
    };

    const onSubmit = (formData: BannerFormInputs) => {
        if (!isEditMode && !hasSelectedPosition) {
            toast.error(t({
                id: 'settings.banners.editor.position_required',
                message: 'Select a banner position first.'
            }));
            return;
        }

        const payload: BannerCreatePayload = {
            title: formData.title,
            content_html: formData.contentHtml,
            banner_type: formData.bannerType,
            position: formData.position,
            is_active: formData.isActive,
            order: formData.order
        };

        if (isEditMode) {
            updateMutation.mutate(payload as BannerUpdatePayload);
            return;
        }

        createMutation.mutate(payload);
    };

    const handlePositionChange = (value: BannerPosition) => {
        const nextType: BannerType = value === 'top' || value === 'bottom' ? 'horizontal' : 'sidebar';
        setValue('bannerType', nextType, { shouldDirty: true });
        setValue('position', value, { shouldDirty: true });
        setHasSelectedPosition(true);
    };

    const isSaving = createMutation.isPending || updateMutation.isPending;
    const editorPanel = (
        <div className="space-y-5">
            {!isEditMode && !hasSelectedPosition && (
                <div className="rounded-2xl border border-warning-line bg-warning-surface px-4 py-3">
                    <p className="text-base font-semibold text-warning">
                        <Trans id="settings.banners.editor.position_prompt.title">
                            Choose a banner position first.
                        </Trans>
                    </p>
                    <p className="mt-1 text-xs font-medium text-warning">
                        <Trans id="settings.banners.editor.position_prompt.description">
                            Select top, bottom, left, or right to set the type and position automatically.
                        </Trans>
                    </p>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
                {bannerPositionOptions.map((slot) => {
                    const active = hasSelectedPosition && slot === position;
                    return (
                        <button
                            key={slot}
                            type="button"
                            aria-pressed={active}
                            onClick={() => handlePositionChange(slot)}
                            className={cx(
                                'min-h-11 rounded-full border px-3 py-1 text-xs font-semibold transition-colors [@media(pointer:fine)]:min-h-9',
                                active ? 'border-line-strong bg-action text-content-inverted' : 'border-line bg-surface text-content hover:border-line-strong',
                                !hasSelectedPosition ? 'ring-2 ring-warning-line' : ''
                            )}>
                            {i18n._(bannerPositionMessages[slot])}
                        </button>
                    );
                })}
                <span
                    className={cx(
                        'text-xs',
                        hasSelectedPosition ? 'text-content-hint' : 'font-semibold text-warning'
                    )}>
                    <Trans id="settings.banners.editor.position_help">
                        The banner type is set automatically when you choose a position.
                    </Trans>
                </span>
            </div>

            <Input
                density="compact"
                label={t({
                    id: 'settings.banners.editor.name.label',
                    message: 'Banner name'
                })}
                placeholder={t({
                    id: 'settings.banners.editor.name.placeholder',
                    message: 'e.g. Main announcement banner'
                })}
                error={errors.title?.message}
                {...register('title')}
            />

            <div className="grid gap-3 sm:grid-cols-2">
                <Input
                    density="compact"
                    type="number"
                    min={0}
                    label={t({
                        id: 'settings.banners.editor.order.label',
                        message: 'Display order'
                    })}
                    error={errors.order?.message}
                    {...register('order', { valueAsNumber: true })}
                />

                <div className="space-y-1.5">
                    <label className="ml-1 block text-sm font-medium text-content">
                        <Trans id="settings.banners.editor.active.heading">Banner visibility</Trans>
                    </label>
                    <div className="min-h-12 rounded-lg border border-line bg-surface px-3 py-2">
                        <Checkbox
                            checked={isActive}
                            onCheckedChange={(checked) => setValue('isActive', checked, { shouldDirty: true })}
                            label={t({
                                id: 'settings.banners.editor.active.label',
                                message: 'Active'
                            })}
                            description={t({
                                id: 'settings.banners.editor.active.description',
                                message: 'Only active banners are displayed'
                            })}
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <div className="block text-sm font-semibold text-content">
                    <Trans id="settings.banners.editor.html.label">Banner HTML</Trans>
                </div>
                <Controller
                    name="contentHtml"
                    control={control}
                    render={({ field }) => (
                        <CodeEditor
                            ariaLabel={t({
                                id: 'settings.banners.editor.html.label',
                                message: 'Banner HTML'
                            })}
                            language="html"
                            value={field.value}
                            onChange={field.onChange}
                            height="380px"
                            error={errors.contentHtml?.message}
                        />
                    )}
                />
                <p className="text-xs text-content-secondary">
                    {isGlobal
                        ? <Trans id="settings.banners.editor.html.global_help">
                            Global banners may include scripts.
                        </Trans>
                        : <Trans id="settings.banners.editor.html.user_help">
                            Scripts are restricted in user banners.
                        </Trans>}
                </p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-surface pb-16">
            <form onSubmit={handleSubmit(onSubmit)}>
                <div className="sticky top-0 z-10 border-b border-line bg-surface">
                    <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:px-6">
                        <button
                            type="button"
                            className="flex min-h-11 items-center gap-2 py-2 text-sm text-content-secondary transition-colors hover:text-content active:text-content-secondary [@media(pointer:fine)]:min-h-9"
                            onClick={() => navigateToList()}>
                            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                            <span><Trans id="settings.banners.editor.back_to_list">Back to list</Trans></span>
                        </button>

                        <h1 className="text-sm font-medium text-content-secondary">
                            {isEditMode && title
                                ? title
                                : isEditMode
                                    ? i18n._({
                                        id: 'settings.banners.editor.edit_title',
                                        message: '{scope, select, global {Edit global banner} other {Edit banner}}',
                                        values: { scope }
                                    })
                                    : i18n._({
                                        id: 'settings.banners.editor.create_title',
                                        message: '{scope, select, global {Create global banner} other {Create banner}}',
                                        values: { scope }
                                    })}
                        </h1>
                    </div>
                </div>

                <div className="mx-auto max-w-[1720px] space-y-6 px-4 pb-8 pt-6 md:px-6">
                    <BannerPreviewFrame
                        contentHtml={contentHtml}
                        position={position}
                        hasSelectedPosition={hasSelectedPosition}
                        onPositionChange={handlePositionChange}
                        editorPanel={editorPanel}
                    />
                </div>

                <FloatingBottomBar>
                    {isEditMode && (
                        <>
                            <Button
                                density="compact"
                                type="button"
                                variant="ghost"
                                size="md"
                                isLoading={deleteMutation.isPending}
                                disabled={isSaving}
                                onClick={handleDelete}
                                className="!rounded-full !text-danger hover:!bg-danger-surface hover:!text-danger">
                                <Trans id="common.delete">Delete</Trans>
                            </Button>
                            <div className="mx-1 h-8 w-px bg-line/60" />
                        </>
                    )}

                    <div className="hidden items-center px-1.5 text-xs text-content-secondary sm:flex">
                        {i18n._(bannerTypeMessages[bannerType])}
                        {' · '}
                        {i18n._(bannerPositionMessages[position])}
                    </div>

                    <Button
                        density="compact"
                        type="submit"
                        variant="primary"
                        className="!rounded-full"
                        leftIcon={!isSaving ? <Send className="h-4 w-4" /> : undefined}
                        isLoading={isSaving}
                        disabled={deleteMutation.isPending}>
                        {isSaving
                            ? <Trans id="common.saving">Saving</Trans>
                            : isEditMode
                                ? <Trans id="common.update">Update</Trans>
                                : <Trans id="common.create">Create</Trans>}
                    </Button>
                </FloatingBottomBar>
            </form>
        </div>
    );
};

export default BannerEditorBase;
