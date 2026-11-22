import { useMemo, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { toast } from '~/utils/toast';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Megaphone, Pencil, Power, Trash2 } from '@blex/ui/icons';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useConfirm } from '~/hooks/useConfirm';
import {
    SettingsEmptyState,
    SettingsHeader,
    SettingsHeaderAction,
    SettingsListItem
} from '../../components';
import {
    Button,
    Checkbox,
    Dropdown,
    Input
} from '~/components/shared';
import { SETTINGS_LIST_TITLE } from '~/styles/settingsStyles';
import {
    getNotices,
    createNotice,
    updateNotice,
    deleteNotice,
    getGlobalNotices,
    createGlobalNotice,
    updateGlobalNotice,
    deleteGlobalNotice,
    type NoticeData,
    type NoticeCreateData,
    type NoticeUpdateData,
    type GlobalNoticeData,
    type GlobalNoticeCreateData,
    type GlobalNoticeUpdateData
} from '~/lib/api/settings';

type NoticeScope = 'user' | 'global';
type NoticeItem = NoticeData | GlobalNoticeData;
type NoticeCreatePayload = NoticeCreateData | GlobalNoticeCreateData;
type NoticeUpdatePayload = NoticeUpdateData | GlobalNoticeUpdateData;

interface NoticeSettingBaseProps {
    scope: NoticeScope;
}

const isValidNoticeUrl = (value: string) => {
    if (value.startsWith('/')) {
        return true;
    }

    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
};

interface NoticeFormInputs {
    title: string;
    url: string;
    isActive: boolean;
}

const defaultValues: NoticeFormInputs = {
    title: '',
    url: '',
    isActive: true
};

const NoticeSettingBase = ({ scope }: NoticeSettingBaseProps) => {
    const { i18n, t } = useLingui();
    const [showForm, setShowForm] = useState(false);
    const [editingNotice, setEditingNotice] = useState<NoticeItem | null>(null);
    const { confirm } = useConfirm();
    const queryClient = useQueryClient();
    const noticeSchema = useMemo(() => z.object({
        title: z.string().trim()
            .min(1, t({
                id: 'settings.notices.validation.title_required',
                message: 'Enter a notice title.'
            }))
            .max(200, t({
                id: 'settings.notices.validation.title_max_length',
                message: 'Notice titles must be 200 characters or fewer.'
            })),
        url: z.string().trim()
            .min(1, t({
                id: 'settings.notices.validation.url_required',
                message: 'Enter a URL.'
            }))
            .refine(
                isValidNoticeUrl,
                t({
                    id: 'settings.notices.validation.url_invalid',
                    message: 'Enter an absolute HTTP(S) URL or an internal path beginning with /.'
                })
            ),
        isActive: z.boolean()
    }), [t]);
    const {
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
        formState: { errors }
    } = useForm<NoticeFormInputs>({
        resolver: zodResolver(noticeSchema),
        defaultValues
    });

    const isGlobal = scope === 'global';
    const queryKey = isGlobal ? ['global-notices'] : ['notices'];

    const { data: noticesData } = useSuspenseQuery({
        queryKey,
        queryFn: async () => {
            const { data } = isGlobal ? await getGlobalNotices() : await getNotices();
            if (data.status === 'DONE') {
                return data.body.notices as NoticeItem[];
            }
            throw new Error(t({
                id: 'settings.notices.load_failed',
                message: 'Could not load notices.'
            }));
        }
    });

    const createMutation = useMutation({
        mutationFn: (data: NoticeCreatePayload) => (
            isGlobal
                ? createGlobalNotice(data as GlobalNoticeCreateData)
                : createNotice(data as NoticeCreateData)
        ),
        onSuccess: () => {
            toast.success(i18n._({
                id: 'settings.notices.create.success',
                message: '{scope, select, global {Global notice created.} other {Notice created.}}',
                values: { scope }
            }));
            queryClient.invalidateQueries({ queryKey });
            closeForm();
        },
        onError: () => {
            toast.error(i18n._({
                id: 'settings.notices.create.failed',
                message: '{scope, select, global {Could not create the global notice.} other {Could not create the notice.}}',
                values: { scope }
            }));
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: NoticeUpdatePayload }) => (
            isGlobal
                ? updateGlobalNotice(id, data as GlobalNoticeUpdateData)
                : updateNotice(id, data as NoticeUpdateData)
        ),
        onSuccess: () => {
            toast.success(i18n._({
                id: 'settings.notices.update.success',
                message: '{scope, select, global {Global notice updated.} other {Notice updated.}}',
                values: { scope }
            }));
            queryClient.invalidateQueries({ queryKey });
            closeForm();
        },
        onError: () => {
            toast.error(i18n._({
                id: 'settings.notices.update.failed',
                message: '{scope, select, global {Could not update the global notice.} other {Could not update the notice.}}',
                values: { scope }
            }));
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => (isGlobal ? deleteGlobalNotice(id) : deleteNotice(id)),
        onSuccess: () => {
            toast.success(i18n._({
                id: 'settings.notices.delete.success',
                message: '{scope, select, global {Global notice deleted.} other {Notice deleted.}}',
                values: { scope }
            }));
            queryClient.invalidateQueries({ queryKey });
        },
        onError: () => {
            toast.error(i18n._({
                id: 'settings.notices.delete.failed',
                message: '{scope, select, global {Could not delete the global notice.} other {Could not delete the notice.}}',
                values: { scope }
            }));
        }
    });

    const onSubmit = (formData: NoticeFormInputs) => {
        const payload = {
            title: formData.title,
            url: formData.url,
            is_active: formData.isActive
        };

        if (editingNotice) {
            updateMutation.mutate({
                id: editingNotice.id,
                data: payload
            });
        } else {
            createMutation.mutate(payload);
        }
    };

    const handleDelete = async (id: number) => {
        const confirmed = await confirm({
            title: i18n._({
                id: 'settings.notices.delete.title',
                message: '{scope, select, global {Delete global notice} other {Delete notice}}',
                values: { scope }
            }),
            message: i18n._({
                id: 'settings.notices.delete.confirm',
                message: '{scope, select, global {Delete this global notice?} other {Delete this notice?}}',
                values: { scope }
            }),
            confirmText: t({
                id: 'common.delete',
                message: 'Delete'
            })
        });

        if (confirmed) {
            deleteMutation.mutate(id);
        }
    };

    const handleEdit = (notice: NoticeItem) => {
        setEditingNotice(notice);
        reset({
            title: notice.title,
            url: notice.url,
            isActive: notice.isActive
        });
        setShowForm(true);
    };

    const handleToggleActive = (notice: NoticeItem) => {
        updateMutation.mutate({
            id: notice.id,
            data: { is_active: !notice.isActive }
        });
    };

    const handleCreate = () => {
        setEditingNotice(null);
        reset(defaultValues);
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingNotice(null);
        reset(defaultValues);
    };

    const isSubmitting = createMutation.isPending || updateMutation.isPending;
    const createAction = (
        <SettingsHeaderAction
            onClick={handleCreate}
            variant="primary">
            <Trans id="settings.notices.create_action">Add notice</Trans>
        </SettingsHeaderAction>
    );

    return (
        <div className="space-y-8">
            <SettingsHeader
                title={i18n._({
                    id: 'settings.notices.title_count',
                    message: '{scope, select, global {Global notices ({count})} other {Notices ({count})}}',
                    values: {
                        scope,
                        count: noticesData?.length || 0
                    }
                })}
                description={
                    isGlobal
                        ? t({
                            id: 'settings.notices.global.description',
                            message: 'Active notices are shown across the entire site.'
                        })
                        : undefined
                }
                actionPosition="right"
                action={noticesData && noticesData.length > 0 ? createAction : undefined}
            />

            {showForm && (
                <form
                    className="bg-surface-subtle border border-line rounded-2xl p-6 animate-in fade-in-0 slide-in-from-top-2 motion-interaction"
                    onSubmit={handleSubmit(onSubmit)}>
                    <h3 className="text-base font-semibold text-content mb-4">
                        {editingNotice
                            ? i18n._({
                                id: 'settings.notices.form.edit_title',
                                message: '{scope, select, global {Edit global notice} other {Edit notice}}',
                                values: { scope }
                            })
                            : i18n._({
                                id: 'settings.notices.form.create_title',
                                message: '{scope, select, global {Create global notice} other {Create notice}}',
                                values: { scope }
                            })}
                    </h3>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label
                                htmlFor={isGlobal ? 'global-notice-title' : 'notice-title'}
                                className="block text-sm font-medium text-content">
                                <Trans id="settings.notices.form.title.label">Notice title</Trans>
                            </label>
                            <Input
                                density="compact"
                                id={isGlobal ? 'global-notice-title' : 'notice-title'}
                                placeholder={t({
                                    id: 'settings.notices.form.title.placeholder',
                                    message: 'Enter a notice title'
                                })}
                                error={errors.title?.message}
                                {...register('title')}
                            />
                        </div>

                        <div className="space-y-2">
                            <label
                                htmlFor={isGlobal ? 'global-notice-url' : 'notice-url'}
                                className="block text-sm font-medium text-content">
                                URL
                            </label>
                            <Input
                                density="compact"
                                id={isGlobal ? 'global-notice-url' : 'notice-url'}
                                placeholder="https://example.com/notice"
                                error={errors.url?.message}
                                {...register('url')}
                            />
                            {!isGlobal && (
                                <p className="text-xs text-content-secondary">
                                    <Trans id="settings.notices.form.url.help">
                                        Visitors go to this URL when they select the notice.
                                    </Trans>
                                </p>
                            )}
                        </div>

                        <div className="p-4 bg-surface-subtle rounded-xl border border-line">
                            <Checkbox
                                checked={watch('isActive')}
                                onCheckedChange={(checked) => setValue('isActive', checked)}
                                label={t({
                                    id: 'settings.notices.form.active.label',
                                    message: 'Active'
                                })}
                                description={
                                    isGlobal
                                        ? undefined
                                        : t({
                                            id: 'settings.notices.form.active.help',
                                            message: 'Only active notices are shown on your blog.'
                                        })
                                }
                            />
                        </div>

                        <div className="flex items-center justify-between gap-3">
                            <Button
                                density="compact"
                                type="button"
                                variant="ghost"
                                size="md"
                                className="min-h-11! [@media(pointer:fine)]:min-h-10!"
                                onClick={closeForm}
                                disabled={isSubmitting}>
                                <Trans id="common.cancel">Cancel</Trans>
                            </Button>
                            <div className="flex items-center gap-3">
                                <Button
                                    density="compact"
                                    type="submit"
                                    variant="primary"
                                    size="md"
                                    className="min-h-11! [@media(pointer:fine)]:min-h-10!"
                                    isLoading={isSubmitting}>
                                    {isSubmitting
                                        ? <Trans id="common.saving">Saving</Trans>
                                        : editingNotice
                                            ? <Trans id="common.update">Update</Trans>
                                            : <Trans id="common.create">Create</Trans>}
                                </Button>
                            </div>
                        </div>
                    </div>
                </form>
            )}

            {noticesData && noticesData.length > 0 ? (
                <div className="space-y-3">
                    {noticesData.map((notice) => (
                        <SettingsListItem
                            key={notice.id}
                            actions={
                                <Dropdown
                                    density="compact"
                                    triggerAriaLabel={isGlobal
                                        ? i18n._({
                                            id: 'settings.notices.list.global_menu_label',
                                            message: 'Open menu for global notice “{title}”',
                                            values: { title: notice.title }
                                        })
                                        : i18n._({
                                            id: 'settings.notices.list.user_menu_label',
                                            message: 'Open menu for notice “{title}”',
                                            values: { title: notice.title }
                                        })}
                                    triggerClassName="min-h-11 min-w-11 [@media(pointer:fine)]:min-h-9 [@media(pointer:fine)]:min-w-9"
                                    items={[
                                        {
                                            label: notice.isActive
                                                ? t({
                                                    id: 'settings.notices.action.deactivate',
                                                    message: 'Deactivate'
                                                })
                                                : t({
                                                    id: 'settings.notices.action.activate',
                                                    message: 'Activate'
                                                }),
                                            icon: <Power aria-hidden="true" className="h-4 w-4" />,
                                            onClick: () => handleToggleActive(notice)
                                        },
                                        {
                                            label: t({
                                                id: 'common.edit',
                                                message: 'Edit'
                                            }),
                                            icon: <Pencil aria-hidden="true" className="h-4 w-4" />,
                                            onClick: () => handleEdit(notice)
                                        },
                                        {
                                            label: t({
                                                id: 'common.delete',
                                                message: 'Delete'
                                            }),
                                            icon: <Trash2 aria-hidden="true" className="h-4 w-4" />,
                                            onClick: () => handleDelete(notice.id),
                                            variant: 'danger'
                                        }
                                    ]}
                                />
                            }>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className={`${SETTINGS_LIST_TITLE} mb-0`}>{notice.title}</h3>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${notice.isActive ? 'bg-action text-content-inverted border-line-strong' : 'bg-surface-subtle text-content-secondary border-line-light'}`}>
                                        {notice.isActive
                                            ? <Trans id="settings.notices.status.active">Active</Trans>
                                            : <Trans id="settings.notices.status.inactive">Inactive</Trans>}
                                    </span>
                                </div>
                                <p className="text-sm text-content-secondary truncate max-w-md">{notice.url}</p>
                            </div>
                        </SettingsListItem>
                    ))}
                </div>
            ) : !showForm ? (
                <SettingsEmptyState
                    icon={<Megaphone aria-hidden="true" className="h-4 w-4" />}
                    title={isGlobal
                        ? t({
                            id: 'settings.notices.empty.global',
                            message: 'No global notices yet'
                        })
                        : t({
                            id: 'settings.notices.empty.user',
                            message: 'No notices yet'
                        })}
                    action={createAction}
                />
            ) : null}
        </div>
    );
};

export default NoticeSettingBase;
