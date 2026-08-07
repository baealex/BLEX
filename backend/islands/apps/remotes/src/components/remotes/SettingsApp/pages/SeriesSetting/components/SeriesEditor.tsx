import { useEffect, useMemo, useRef } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Link, useNavigate, useBlocker } from '@tanstack/react-router';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from '~/utils/toast';
import { useConfirm } from '~/hooks/useConfirm';
import { Button, Input } from '~/components/shared';
import { FloatingBottomBar } from '@blex/ui/floating-bottom-bar';
import { ArrowLeft, ChevronDown, Send } from '@blex/ui/icons';
import {
    getSeriesDetail,
    getAvailablePosts,
    getAccountSettings,
    createSeries,
    updateSeries,
    deleteSeriesById
} from '~/lib/api/settings';
import PostSelector from './PostSelector';

interface SeriesFormInputs {
    name: string;
    customUrl?: string;
    description: string;
    postIds: number[];
}

const defaultValues: SeriesFormInputs = {
    name: '',
    customUrl: '',
    description: '',
    postIds: []
};

const normalizeSeriesUrlInput = (text: string) => {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9가-힣\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 50);
};

const normalizeSeriesUrlForSubmit = (text: string) => {
    return normalizeSeriesUrlInput(text)
        .replace(/^-|-$/g, '');
};

const generateSeriesUrlFromTitle = (title: string) => normalizeSeriesUrlForSubmit(title);

interface SeriesEditorProps {
    seriesId?: number;
}

const SeriesEditor = ({ seriesId }: SeriesEditorProps) => {
    const { i18n, t } = useLingui();
    const seriesSchema = useMemo(() => z.object({
        name: z.string().trim()
            .min(1, t({
                id: 'settings.series.editor.name.validation.required',
                message: 'Enter a series title.'
            }))
            .max(50, t({
                id: 'settings.series.editor.name.validation.max_length',
                message: 'Series title must be 50 characters or fewer.'
            })),
        customUrl: z.string().max(50, t({
            id: 'settings.series.editor.url.validation.max_length',
            message: 'URL must be 50 characters or fewer.'
        })).optional(),
        description: z.string().trim().max(500, t({
            id: 'settings.series.editor.description.validation.max_length',
            message: 'Series description must be 500 characters or fewer.'
        })),
        postIds: z.array(z.number())
    }), [t]);
    const isEditMode = seriesId !== undefined;
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { confirm } = useConfirm();
    const allowNavigationRef = useRef(false);

    const { data: seriesDetail } = useSuspenseQuery({
        queryKey: ['series-detail', seriesId],
        queryFn: async () => {
            if (!seriesId) {
                return null;
            }

            const { data } = await getSeriesDetail(seriesId);
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error(data.errorMessage || t({
                id: 'settings.series.editor.load_detail_failed',
                message: 'Could not load the series.'
            }));
        }
    });

    const { data: availablePosts } = useSuspenseQuery({
        queryKey: ['series-available-posts', seriesId],
        queryFn: async () => {
            const { data } = await getAvailablePosts(seriesId);
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error(data.errorMessage || t({
                id: 'settings.series.editor.load_posts_failed',
                message: 'Could not load posts.'
            }));
        }
    });

    const { data: accountSettings } = useSuspenseQuery({
        queryKey: ['settings-account'],
        queryFn: async () => {
            const { data } = await getAccountSettings();
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error(data.errorMessage || t({
                id: 'settings.series.editor.load_account_failed',
                message: 'Could not load account information.'
            }));
        }
    });

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        reset,
        formState: { errors, isDirty }
    } = useForm<SeriesFormInputs>({
        resolver: zodResolver(seriesSchema),
        defaultValues
    });

    useEffect(() => {
        if (!seriesDetail) {
            reset(defaultValues);
            return;
        }

        reset({
            name: seriesDetail.name,
            customUrl: '',
            description: seriesDetail.description ?? '',
            postIds: seriesDetail.postIds ?? []
        });
    }, [seriesDetail, reset]);

    useBlocker({
        shouldBlockFn: async () => {
            if (!isDirty || allowNavigationRef.current) return false;
            const confirmed = await confirm({
                title: t({
                    id: 'settings.series.editor.unsaved.title',
                    message: 'Unsaved changes'
                }),
                message: t({
                    id: 'settings.series.editor.unsaved.message',
                    message: 'Your changes have not been saved. Leave this page?'
                }),
                confirmText: t({
                    id: 'settings.series.editor.unsaved.leave',
                    message: 'Leave'
                }),
                variant: 'danger'
            });
            return !confirmed;
        },
        enableBeforeUnload: () => isDirty && !allowNavigationRef.current
    });

    const invalidateSeriesQueries = () => {
        queryClient.invalidateQueries({ queryKey: ['series-setting'] });
        queryClient.invalidateQueries({ queryKey: ['series-detail'] });
        queryClient.invalidateQueries({ queryKey: ['series-available-posts'] });
    };

    const createMutation = useMutation({
        mutationFn: (formData: SeriesFormInputs) => createSeries({
            name: formData.name,
            url: normalizeSeriesUrlForSubmit(formData.customUrl ?? ''),
            description: formData.description,
            post_ids: formData.postIds
        }),
        onSuccess: ({ data }) => {
            if (data.status === 'ERROR') {
                toast.error(data.errorMessage || t({
                    id: 'settings.series.editor.create_failed',
                    message: 'Could not create the series.'
                }));
                return;
            }

            toast.success(t({
                id: 'settings.series.editor.create_success',
                message: 'Series created.'
            }));
            invalidateSeriesQueries();
            allowNavigationRef.current = true;
            navigate({
                to: '/series',
                replace: true
            });
        },
        onError: () => {
            toast.error(t({
                id: 'settings.series.editor.create_failed',
                message: 'Could not create the series.'
            }));
        }
    });

    const updateMutation = useMutation({
        mutationFn: (formData: SeriesFormInputs) => {
            if (!seriesId) {
                throw new Error('seriesId is required');
            }

            return updateSeries(seriesId, {
                name: formData.name,
                description: formData.description,
                post_ids: formData.postIds
            });
        },
        onSuccess: ({ data }) => {
            if (data.status === 'ERROR') {
                toast.error(data.errorMessage || t({
                    id: 'settings.series.editor.update_failed',
                    message: 'Could not update the series.'
                }));
                return;
            }

            toast.success(t({
                id: 'settings.series.editor.update_success',
                message: 'Series updated.'
            }));
            invalidateSeriesQueries();
            allowNavigationRef.current = true;
            navigate({
                to: '/series',
                replace: true
            });
        },
        onError: () => {
            toast.error(t({
                id: 'settings.series.editor.update_failed',
                message: 'Could not update the series.'
            }));
        }
    });

    const deleteMutation = useMutation({
        mutationFn: () => {
            if (!seriesId) {
                throw new Error('seriesId is required');
            }
            return deleteSeriesById(seriesId);
        },
        onSuccess: ({ data }) => {
            if (data.status === 'ERROR') {
                toast.error(data.errorMessage || t({
                    id: 'settings.series.delete.failed',
                    message: 'Could not delete the series.'
                }));
                return;
            }

            toast.success(t({
                id: 'settings.series.delete.success',
                message: 'Series deleted.'
            }));
            invalidateSeriesQueries();
            allowNavigationRef.current = true;
            navigate({
                to: '/series',
                replace: true
            });
        },
        onError: () => {
            toast.error(t({
                id: 'settings.series.delete.failed',
                message: 'Could not delete the series.'
            }));
        }
    });

    const handleDelete = async () => {
        const confirmed = await confirm({
            title: t({
                id: 'settings.series.delete.title',
                message: 'Delete series'
            }),
            message: i18n._({
                id: 'settings.series.editor.delete_confirm',
                message: 'Deleting "{title}" keeps its posts but removes their series assignment.\n\nThis action cannot be undone. Continue?',
                values: { title: titleValue }
            }),
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

    const onSubmit = (formData: SeriesFormInputs) => {
        if (isEditMode) {
            updateMutation.mutate(formData);
            return;
        }

        createMutation.mutate(formData);
    };

    const titleValue = watch('name');
    const customUrlValue = watch('customUrl') ?? '';
    const selectedPostIds = watch('postIds');
    const isSaving = createMutation.isPending || updateMutation.isPending;
    const customSlug = normalizeSeriesUrlForSubmit(customUrlValue);
    const previewSlug = customSlug || generateSeriesUrlFromTitle(titleValue || '');
    const fixedSlug = isEditMode ? (seriesDetail?.url || previewSlug) : previewSlug;
    const seriesPath = `/@${accountSettings.username}/series/${fixedSlug || 'series-url'}`;

    const handleCopySeriesUrl = async () => {
        try {
            await navigator.clipboard.writeText(`${window.location.origin}${seriesPath}`);
            toast.success(t({
                id: 'settings.series.editor.url.copy_success',
                message: 'Series URL copied.'
            }));
        } catch {
            toast.error(t({
                id: 'settings.series.editor.url.copy_failed',
                message: 'Could not copy the series URL.'
            }));
        }
    };

    return (
        <div className="min-h-screen bg-surface pb-20">
            <form onSubmit={handleSubmit(onSubmit)}>
                <div className="sticky top-0 z-10 bg-surface border-b border-line">
                    <div className="max-w-4xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
                        <Link
                            to="/series"
                            className="flex min-h-11 items-center gap-2 py-2 text-sm text-content-secondary transition-colors hover:text-content active:text-content-secondary [@media(pointer:fine)]:min-h-9">
                            <ArrowLeft aria-hidden className="h-4 w-4" />
                            <span>
                                <Trans id="settings.series.editor.back_to_list">
                                    Back to series
                                </Trans>
                            </span>
                        </Link>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto px-4 md:px-6 pt-10 pb-10 space-y-10">
                    <section className="space-y-4">
                        <h1 className="sr-only">
                            {isEditMode
                                ? t({
                                    id: 'settings.series.editor.edit_title',
                                    message: 'Edit series'
                                })
                                : t({
                                    id: 'settings.series.editor.create_title',
                                    message: 'Create series'
                                })}
                        </h1>

                        <div className="space-y-2">
                            <label
                                htmlFor="series-name"
                                className="ml-1 block text-sm font-medium text-content-secondary">
                                <Trans id="settings.series.editor.name.label">
                                    Series title
                                </Trans>
                            </label>
                            <div className="relative rounded-lg border border-line bg-surface-elevated px-3 py-3 transition-all duration-150 focus-within:border-line-strong focus-within:ring-2 focus-within:ring-line/70">
                                <input
                                    id="series-name"
                                    type="text"
                                    maxLength={50}
                                    placeholder={t({
                                        id: 'settings.series.editor.name.placeholder',
                                        message: 'Enter a series title'
                                    })}
                                    className="w-full border-none bg-transparent pr-20 text-2xl font-bold text-content outline-none placeholder-content-hint"
                                    {...register('name')}
                                />
                                <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium ${titleValue.length > 40 ? 'text-danger' : 'text-content-hint'}`}>
                                    {titleValue.length}/50
                                </span>
                            </div>
                        </div>
                        {errors.name?.message && (
                            <p className="text-sm text-danger">{errors.name.message}</p>
                        )}
                    </section>

                    <PostSelector
                        posts={availablePosts}
                        selectedPostIds={selectedPostIds}
                        onChange={(postIds) => {
                            setValue('postIds', postIds, { shouldDirty: true });
                        }}
                    />

                    <section>
                        <Input
                            density="compact"
                            label={t({
                                id: 'settings.series.editor.description.label',
                                message: 'Series description'
                            })}
                            multiline
                            rows={5}
                            placeholder={t({
                                id: 'settings.series.editor.description.placeholder',
                                message: 'Describe what this series covers.'
                            })}
                            maxLength={500}
                            error={errors.description?.message}
                            helperText={t({
                                id: 'settings.series.editor.description.helper',
                                message: 'Shown at the top of the series. Optional.'
                            })}
                            {...register('description')}
                        />
                    </section>

                    <section className="space-y-3 border-t border-line-light pt-5">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-sm font-semibold text-content-secondary">
                                <Trans id="settings.series.editor.url.title">
                                    Series URL
                                </Trans>
                            </h2>
                            {isEditMode && (
                                <Button
                                    density="compact"
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-10 shrink-0"
                                    onClick={handleCopySeriesUrl}>
                                    <Trans id="common.copy">Copy</Trans>
                                </Button>
                            )}
                        </div>

                        {!isEditMode && (
                            <details className="group">
                                <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm text-content-secondary transition-colors hover:text-content [@media(pointer:fine)]:min-h-9">
                                    <Trans id="settings.series.editor.url.customize">
                                        Customize URL
                                    </Trans>
                                    <ChevronDown aria-hidden className="ml-2 inline h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                                </summary>
                                <div className="mt-3 space-y-2">
                                    <Input
                                        density="compact"
                                        label={t({
                                            id: 'settings.series.editor.url.optional_label',
                                            message: 'URL (optional)'
                                        })}
                                        value={customUrlValue}
                                        onChange={(e) => {
                                            setValue('customUrl', normalizeSeriesUrlInput(e.target.value), {
                                                shouldDirty: true,
                                                shouldValidate: true
                                            });
                                        }}
                                        placeholder="series-url"
                                    />
                                    {errors.customUrl?.message && (
                                        <p className="text-sm text-danger">{errors.customUrl.message}</p>
                                    )}
                                    <p className="text-xs text-content-secondary">
                                        <Trans id="settings.series.editor.url.characters_helper">
                                            Use only English letters, numbers, Korean characters, and hyphens (-).
                                        </Trans>
                                    </p>
                                </div>
                            </details>
                        )}

                        <div className="break-all text-xs font-mono text-content-hint">
                            {seriesPath}
                        </div>

                        <p className="text-xs text-content-secondary">
                            {isEditMode
                                ? t({
                                    id: 'settings.series.editor.url.edit_helper',
                                    message: 'The URL stays the same when you edit the series title.'
                                })
                                : customSlug
                                    ? t({
                                        id: 'settings.series.editor.url.custom_helper',
                                        message: 'The series will use your custom URL.'
                                    })
                                    : t({
                                        id: 'settings.series.editor.url.auto_helper',
                                        message: 'Leave the URL empty to generate one from the title.'
                                    })}
                        </p>
                    </section>

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
                                className="!rounded-full !text-danger hover:!text-danger hover:!bg-danger-surface">
                                <Trans id="common.delete">Delete</Trans>
                            </Button>
                            <div className="w-px h-8 bg-line/60 mx-1" />
                        </>
                    )}

                    <Button
                        density="compact"
                        type="submit"
                        variant="primary"
                        className="!rounded-full"
                        leftIcon={!isSaving ? <Send className="w-4 h-4" /> : undefined}
                        isLoading={isSaving}
                        disabled={deleteMutation.isPending}>
                        {isSaving
                            ? t({
                                id: 'settings.series.editor.saving',
                                message: 'Saving...'
                            })
                            : isEditMode
                                ? t({
                                    id: 'settings.series.editor.update',
                                    message: 'Update'
                                })
                                : t({
                                    id: 'settings.series.editor.create',
                                    message: 'Create'
                                })}
                    </Button>
                </FloatingBottomBar>
            </form>
        </div>
    );
};

export default SeriesEditor;
