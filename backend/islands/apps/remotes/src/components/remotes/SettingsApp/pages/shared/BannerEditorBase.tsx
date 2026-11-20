import { useEffect, useMemo, useRef, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useNavigate, useBlocker } from '@tanstack/react-router';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { FloatingBottomBar } from '@blex/ui/floating-bottom-bar';
import { ArrowLeft, Eye, ImagePlus, Send } from '@blex/ui/icons';
import { CodeEditor } from '~/components/CodeEditor';
import { Button, Input } from '~/components/shared';
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
    previewBanner,
    previewGlobalBanner,
    getBannerTemplates,
    getGlobalBannerTemplates,
    type BannerCreateData,
    type BannerPreviewData,
    type BannerTemplate,
    type BannerTone,
    type BannerUpdateData,
    type GlobalBannerCreateData,
    type GlobalBannerUpdateData
} from '~/lib/api/settings';
import { uploadImage } from '~/lib/api/posts';
import BannerPreviewDialog from './BannerPreviewDialog';
import BannerTemplatePicker from './BannerTemplatePicker';
import {
    bannerPositionMessages,
    bannerPositionOptions,
    bannerTemplateMessages,
    type BannerPosition,
    type BannerType
} from './bannerI18n';
import {
    BANNER_TITLE_MAX_LENGTH,
    bannerTypeForPosition,
    isTemplateAllowedAt,
    isValidBannerLink,
    positionForTemplate,
    swapSampleCopy,
    TEMPLATE_FIELDS,
    type BannerSampleCopy
} from './bannerTemplateRules';

type BannerScope = 'user' | 'global';
type BannerCreatePayload = BannerCreateData | GlobalBannerCreateData;
type BannerUpdatePayload = BannerUpdateData | GlobalBannerUpdateData;

interface BannerFormInputs {
    title: string;
    template: BannerTemplate;
    contentHtml: string;
    headline: string;
    description: string;
    linkLabel: string;
    linkUrl: string;
    imageUrl: string;
    tone: BannerTone;
    bannerType: BannerType;
    position: BannerPosition;
    isActive: boolean;
    order: number;
}

const defaultValues: BannerFormInputs = {
    title: '',
    template: 'card',
    contentHtml: '',
    headline: '',
    description: '',
    linkLabel: '',
    linkUrl: '',
    imageUrl: '',
    tone: 'default',
    bannerType: 'horizontal',
    position: 'bottom',
    isActive: true,
    order: 0
};

const bannerToneOptions: BannerTone[] = ['default', 'emphasis'];

const toPreviewPayload = (values: BannerFormInputs): BannerPreviewData => ({
    template: values.template,
    content_html: values.contentHtml,
    headline: values.headline,
    description: values.description,
    link_label: values.linkLabel,
    link_url: values.linkUrl,
    image_url: values.imageUrl,
    tone: values.tone,
    banner_type: values.bannerType,
    position: values.position
});

interface PreviewState {
    html: string;
    position: BannerPosition;
    bannerType: BannerType;
}

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
    const appliedSampleRef = useRef<BannerSampleCopy | null>(null);
    const [hasChosenTemplate, setHasChosenTemplate] = useState(isEditMode);
    const [isPickingTemplate, setIsPickingTemplate] = useState(!isEditMode);
    const [preview, setPreview] = useState<PreviewState | null>(null);
    const bannerSchema = useMemo(() => z.object({
        title: z.string().trim()
            .max(BANNER_TITLE_MAX_LENGTH, t({
                id: 'settings.banners.validation.title_max_length',
                message: 'Banner names must be 100 characters or fewer.'
            })),
        template: z.enum(['html', 'notice', 'card', 'centered', 'callout', 'image', 'intro', 'profile', 'sidelink']),
        contentHtml: z.string(),
        headline: z.string().trim().max(120, t({
            id: 'settings.banners.validation.headline_max_length',
            message: 'Banner text must be 120 characters or fewer.'
        })),
        description: z.string().trim().max(300, t({
            id: 'settings.banners.validation.description_max_length',
            message: 'Description must be 300 characters or fewer.'
        })),
        linkLabel: z.string().trim().max(40, t({
            id: 'settings.banners.validation.link_label_max_length',
            message: 'Button text must be 40 characters or fewer.'
        })),
        linkUrl: z.string().trim().max(500, t({
            id: 'settings.banners.validation.link_url_max_length',
            message: 'Link must be 500 characters or fewer.'
        })),
        imageUrl: z.string().trim(),
        tone: z.enum(['default', 'emphasis']),
        bannerType: z.enum(['horizontal', 'sidebar']),
        position: z.enum(['top', 'bottom', 'left', 'right']),
        isActive: z.boolean(),
        order: z.number().int().min(0)
    }).superRefine((value, ctx) => {
        if (value.template === 'html') {
            if (!value.title) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['title'],
                    message: t({
                        id: 'settings.banners.validation.title_required',
                        message: 'Enter a banner name.'
                    })
                });
            }
            if (!value.contentHtml.trim()) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['contentHtml'],
                    message: t({
                        id: 'settings.banners.validation.html_required',
                        message: 'Enter banner HTML.'
                    })
                });
            }
            return;
        }

        if (!value.headline) {
            ctx.addIssue({
                code: 'custom',
                path: ['headline'],
                message: t({
                    id: 'settings.banners.validation.headline_required',
                    message: 'Enter the banner text.'
                })
            });
        }
        if (value.template === 'image' && !value.imageUrl) {
            ctx.addIssue({
                code: 'custom',
                path: ['imageUrl'],
                message: t({
                    id: 'settings.banners.validation.image_required',
                    message: 'Upload a banner image.'
                })
            });
        }
        if (value.linkUrl && !isValidBannerLink(value.linkUrl)) {
            ctx.addIssue({
                code: 'custom',
                path: ['linkUrl'],
                message: t({
                    id: 'settings.banners.validation.link_url_invalid',
                    message: 'Enter a link that starts with https://, http://, or /.'
                })
            });
        }
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

    const { data: gallery } = useSuspenseQuery({
        queryKey: [isGlobal ? 'global-banner-templates' : 'banner-templates'],
        queryFn: async () => {
            const { data } = isGlobal ? await getGlobalBannerTemplates() : await getBannerTemplates();
            if (data.status === 'DONE') {
                return data.body.templates;
            }

            throw new Error(data.errorMessage);
        }
    });

    const {
        register,
        handleSubmit,
        control,
        watch,
        setValue,
        getValues,
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
        appliedSampleRef.current = null;
        if (!bannerDetail) {
            reset(defaultValues);
            if (!isEditMode) {
                setHasChosenTemplate(false);
                setIsPickingTemplate(true);
            }
            return;
        }

        reset({
            title: bannerDetail.title,
            template: bannerDetail.template,
            contentHtml: bannerDetail.contentHtml,
            headline: bannerDetail.headline,
            description: bannerDetail.description,
            linkLabel: bannerDetail.linkLabel,
            linkUrl: bannerDetail.linkUrl,
            imageUrl: bannerDetail.imageUrl,
            tone: bannerDetail.tone,
            bannerType: bannerDetail.bannerType,
            position: bannerDetail.position,
            isActive: bannerDetail.isActive,
            order: bannerDetail.order
        });
        setHasChosenTemplate(true);
        setIsPickingTemplate(false);
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

    const imageUploadMutation = useMutation({
        mutationFn: (file: File) => uploadImage(file),
        onSuccess: ({ data }) => {
            if (data.status === 'ERROR') {
                toast.error(data.errorMessage || t({
                    id: 'settings.banners.image.upload_failed',
                    message: 'Could not upload the image.'
                }));
                return;
            }

            setValue('imageUrl', data.body.url, {
                shouldDirty: true,
                shouldValidate: true
            });
        },
        onError: () => {
            toast.error(t({
                id: 'common.network_error',
                message: 'A network error occurred.'
            }));
        }
    });

    const previewMutation = useMutation({
        mutationFn: (values: BannerFormInputs) => {
            const payload = toPreviewPayload(values);
            return isGlobal ? previewGlobalBanner(payload) : previewBanner(payload);
        },
        onSuccess: ({ data }, values) => {
            if (data.status === 'ERROR') {
                toast.error(data.errorMessage || t({
                    id: 'settings.banners.preview.failed',
                    message: 'Could not prepare the preview.'
                }));
                return;
            }

            setPreview({
                html: data.body.html,
                position: values.position,
                bannerType: values.bannerType
            });
        },
        onError: () => {
            toast.error(t({
                id: 'common.network_error',
                message: 'A network error occurred.'
            }));
        }
    });

    const template = watch('template');
    const bannerType = watch('bannerType');
    const position = watch('position');
    const title = watch('title');
    const tone = watch('tone');
    const imageUrl = watch('imageUrl');
    const isTextTemplate = template !== 'html';
    const fields = template === 'html' ? null : TEMPLATE_FIELDS[template];
    const allowHtml = isGlobal || bannerDetail?.template === 'html';
    const positionOptions = bannerPositionOptions.filter((slot) => isTemplateAllowedAt(template, slot));

    const sampleFor = (nextTemplate: BannerTemplate): BannerSampleCopy | null => (
        gallery.find((item) => item.template === nextTemplate)?.sample ?? null
    );

    const handleTemplateChange = (nextTemplate: BannerTemplate) => {
        const nextSample = sampleFor(nextTemplate);
        if (nextSample) {
            const copy = swapSampleCopy({
                headline: getValues('headline'),
                description: getValues('description'),
                linkLabel: getValues('linkLabel'),
                linkUrl: getValues('linkUrl')
            }, appliedSampleRef.current, nextSample);
            appliedSampleRef.current = nextSample;
            setValue('headline', copy.headline, { shouldDirty: true });
            setValue('description', copy.description, { shouldDirty: true });
            setValue('linkLabel', copy.linkLabel, { shouldDirty: true });
            setValue('linkUrl', copy.linkUrl, { shouldDirty: true });
        }

        const nextPosition = positionForTemplate(nextTemplate, hasChosenTemplate ? position : null);
        setValue('template', nextTemplate, { shouldDirty: true });
        setValue('bannerType', bannerTypeForPosition(nextPosition), { shouldDirty: true });
        setValue('position', nextPosition, { shouldDirty: true });
        setHasChosenTemplate(true);
        setIsPickingTemplate(false);
    };

    const handlePositionChange = (nextPosition: BannerPosition) => {
        setValue('bannerType', bannerTypeForPosition(nextPosition), { shouldDirty: true });
        setValue('position', nextPosition, { shouldDirty: true });
    };

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
        if (!isEditMode && !hasChosenTemplate) {
            toast.error(t({
                id: 'settings.banners.editor.template_required',
                message: 'Choose a template first.'
            }));
            return;
        }

        const payload: BannerCreatePayload = {
            ...toPreviewPayload(formData),
            title: formData.template === 'html'
                ? formData.title
                : formData.headline.slice(0, BANNER_TITLE_MAX_LENGTH),
            is_active: formData.isActive,
            order: formData.order
        };

        if (isEditMode) {
            updateMutation.mutate(payload as BannerUpdatePayload);
            return;
        }

        createMutation.mutate(payload);
    };

    const isSaving = createMutation.isPending || updateMutation.isPending;
    const sectionLabelClass = 'mb-3 text-sm font-semibold text-content';

    const headlineLabels: Partial<Record<BannerTemplate, string>> = {
        notice: t({
            id: 'settings.banners.editor.headline.notice_label',
            message: 'Text'
        }),
        image: t({
            id: 'settings.banners.editor.headline.image_label',
            message: 'Image description (alt text)'
        }),
        profile: t({
            id: 'settings.banners.editor.headline.profile_label',
            message: 'Name'
        })
    };

    const textFields = fields && (
        <div className="space-y-4">
            {fields.image && (
                <div className="space-y-2">
                    <div className="ml-1 text-sm font-medium text-content">
                        <Trans id="settings.banners.editor.image.label">Image</Trans>
                    </div>
                    {imageUrl && (
                        <img
                            src={imageUrl}
                            alt=""
                            className="max-h-60 w-full rounded-xl border border-line object-contain"
                        />
                    )}
                    <label
                        className={cx(
                            'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-content transition-colors duration-150 hover:border-line-strong active:scale-95 [@media(pointer:fine)]:min-h-10',
                            imageUploadMutation.isPending && 'pointer-events-none opacity-60'
                        )}>
                        <ImagePlus aria-hidden="true" className="h-4 w-4" />
                        {imageUploadMutation.isPending
                            ? <Trans id="settings.banners.editor.image.uploading">Uploading</Trans>
                            : imageUrl
                                ? <Trans id="settings.banners.editor.image.replace">Replace image</Trans>
                                : <Trans id="settings.banners.editor.image.upload">Upload image</Trans>}
                        <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) {
                                    imageUploadMutation.mutate(file);
                                }
                                event.target.value = '';
                            }}
                        />
                    </label>
                    {errors.imageUrl?.message && (
                        <p className="ml-1 text-xs text-danger">{errors.imageUrl.message}</p>
                    )}
                </div>
            )}

            <Input
                density="compact"
                label={headlineLabels[template] ?? t({
                    id: 'settings.banners.editor.headline.label',
                    message: 'Title'
                })}
                error={errors.headline?.message}
                {...register('headline')}
            />

            {fields.description && (
                <Input
                    density="compact"
                    multiline
                    rows={2}
                    label={t({
                        id: 'settings.banners.editor.description.label',
                        message: 'Description'
                    })}
                    error={errors.description?.message}
                    {...register('description')}
                />
            )}

            <div className={cx('grid gap-3', fields.linkLabel && 'sm:grid-cols-2')}>
                {fields.linkLabel && (
                    <Input
                        density="compact"
                        label={template === 'notice'
                            ? t({
                                id: 'settings.banners.editor.link_label.notice_label',
                                message: 'Link text'
                            })
                            : t({
                                id: 'settings.banners.editor.link_label.label',
                                message: 'Button text'
                            })}
                        placeholder={t({
                            id: 'settings.banners.editor.link_label.placeholder',
                            message: 'Learn more'
                        })}
                        error={errors.linkLabel?.message}
                        {...register('linkLabel')}
                    />
                )}
                <Input
                    density="compact"
                    label={t({
                        id: 'settings.banners.editor.link_url.label',
                        message: 'Link'
                    })}
                    placeholder={t({
                        id: 'settings.banners.editor.link_url.placeholder',
                        message: 'https:// or /@username'
                    })}
                    error={errors.linkUrl?.message}
                    {...register('linkUrl')}
                />
            </div>
        </div>
    );

    const htmlFields = (
        <div className="space-y-4">
            <Input
                density="compact"
                label={t({
                    id: 'settings.banners.editor.name.label',
                    message: 'Banner name'
                })}
                error={errors.title?.message}
                {...register('title')}
            />
            <div className="space-y-2">
                <div className="ml-1 text-sm font-medium text-content">
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
                            height="320px"
                            error={errors.contentHtml?.message}
                        />
                    )}
                />
                <p className="ml-1 text-xs text-content-secondary">
                    {isGlobal
                        ? <Trans id="settings.banners.editor.html.global_help">
                            Global banners may include scripts.
                        </Trans>
                        : <Trans id="settings.banners.editor.html.user_sanitized_help">
                            Only allowed tags and attributes are kept, and scripts are removed. The preview shows what readers will see.
                        </Trans>}
                </p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-surface pb-16">
            <form onSubmit={handleSubmit(onSubmit)}>
                <div className="sticky top-0 z-10 border-b border-line bg-surface">
                    <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4 md:px-6">
                        <button
                            type="button"
                            className="flex min-h-11 items-center gap-2 py-2 text-sm text-content-secondary transition-colors hover:text-content active:text-content-secondary [@media(pointer:fine)]:min-h-9"
                            onClick={() => navigateToList()}>
                            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                            <span><Trans id="settings.banners.editor.back_to_list">Back to list</Trans></span>
                        </button>

                        <h1 className="text-sm font-medium text-content-secondary">
                            {isEditMode
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

                <div className="mx-auto max-w-2xl space-y-8 px-4 pb-20 pt-8 md:px-6">
                    <section>
                        <h2 className={sectionLabelClass}>
                            <Trans id="settings.banners.editor.template.heading">Template</Trans>
                        </h2>
                        {isPickingTemplate ? (
                            <BannerTemplatePicker
                                gallery={gallery}
                                allowHtml={allowHtml}
                                value={hasChosenTemplate ? template : null}
                                onChange={handleTemplateChange}
                            />
                        ) : (
                            <div className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-2">
                                <span className="text-sm font-semibold text-content">
                                    {i18n._(bannerTemplateMessages[template])}
                                </span>
                                <Button
                                    density="compact"
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsPickingTemplate(true)}>
                                    <Trans id="settings.banners.editor.template.change">Change</Trans>
                                </Button>
                            </div>
                        )}
                    </section>

                    {hasChosenTemplate && (
                        <>
                            <section>
                                <h2 className={sectionLabelClass}>
                                    <Trans id="settings.banners.editor.position.heading">Position</Trans>
                                </h2>
                                <div className="flex flex-wrap gap-2">
                                    {positionOptions.map((slot) => (
                                        <button
                                            key={slot}
                                            type="button"
                                            aria-pressed={slot === position}
                                            onClick={() => handlePositionChange(slot)}
                                            className={cx(
                                                'min-h-11 rounded-full border px-4 py-1 text-xs font-semibold transition-colors duration-150 active:scale-95 [@media(pointer:fine)]:min-h-9',
                                                slot === position
                                                    ? 'border-line-strong bg-action text-content-inverted'
                                                    : 'border-line bg-surface text-content hover:border-line-strong'
                                            )}>
                                            {i18n._(bannerPositionMessages[slot])}
                                        </button>
                                    ))}
                                </div>
                                {bannerType === 'sidebar' && (
                                    <p className="mt-2 text-xs text-content-hint">
                                        <Trans id="settings.banners.editor.position.sidebar_help">
                                            Side banners only appear on wide screens (1280px and up).
                                        </Trans>
                                    </p>
                                )}
                            </section>

                            <section>
                                <h2 className={sectionLabelClass}>
                                    <Trans id="settings.banners.editor.content.heading">Content</Trans>
                                </h2>
                                {isTextTemplate ? textFields : htmlFields}
                            </section>

                            {fields?.tone && (
                                <section>
                                    <h2 className={sectionLabelClass}>
                                        <Trans id="settings.banners.editor.tone.label">Style</Trans>
                                    </h2>
                                    <div className="flex flex-wrap gap-2">
                                        {bannerToneOptions.map((option) => (
                                            <button
                                                key={option}
                                                type="button"
                                                aria-pressed={tone === option}
                                                onClick={() => setValue('tone', option, { shouldDirty: true })}
                                                className={cx(
                                                    'min-h-11 rounded-full border px-4 py-1 text-xs font-semibold transition-colors duration-150 active:scale-95 [@media(pointer:fine)]:min-h-9',
                                                    tone === option
                                                        ? 'border-line-strong bg-action text-content-inverted'
                                                        : 'border-line bg-surface text-content hover:border-line-strong'
                                                )}>
                                                {option === 'default'
                                                    ? <Trans id="settings.banners.editor.tone.default">Default</Trans>
                                                    : <Trans id="settings.banners.editor.tone.emphasis">Emphasis</Trans>}
                                            </button>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </>
                    )}
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

                    {hasChosenTemplate && (
                        <Button
                            density="compact"
                            type="button"
                            variant="ghost"
                            size="md"
                            className="!rounded-full"
                            leftIcon={!previewMutation.isPending ? <Eye className="h-4 w-4" /> : undefined}
                            isLoading={previewMutation.isPending}
                            onClick={() => previewMutation.mutate(getValues())}>
                            <Trans id="settings.banners.editor.preview_action">Preview</Trans>
                        </Button>
                    )}

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

            {preview && (
                <BannerPreviewDialog
                    isOpen
                    onClose={() => setPreview(null)}
                    html={preview.html}
                    position={preview.position}
                    bannerType={preview.bannerType}
                />
            )}
        </div>
    );
};

export default BannerEditorBase;
