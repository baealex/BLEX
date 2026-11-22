import { useMemo, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { toast } from '~/utils/toast';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { FileText, Pencil, Trash2 } from '@blex/ui/icons';
import {
    SettingsEmptyState,
    SettingsHeader,
    SettingsHeaderAction,
    SettingsListItem
} from '../../components';
import { Button, Input, Dropdown } from '~/components/shared';
import {
    getSettingsIconClass,
    SETTINGS_LIST_TITLE
} from '~/styles/settingsStyles';
import { useConfirm } from '~/hooks/useConfirm';
import {
    getForms,
    getForm,
    createForm,
    updateForm,
    deleteForm
} from '~/lib/api/forms';

interface FormItem {
    id: number;
    title: string;
    content?: string;
}

interface FormInputs {
    title: string;
    content: string;
}

const FormsManagement = () => {
    const { i18n, t } = useLingui();
    const formSchema = useMemo(() => z.object({
        title: z.string()
            .min(1, t({
                id: 'settings.forms.validation.title_required',
                message: 'Enter a title.'
            }))
            .max(100, t({
                id: 'settings.forms.validation.title_max_length',
                message: 'Title must be 100 characters or fewer.'
            })),
        content: z.string().min(1, t({
            id: 'settings.forms.validation.content_required',
            message: 'Enter template content.'
        }))
    }), [t]);
    const { confirm } = useConfirm();
    const [showForm, setShowForm] = useState(false);
    const [editingForm, setEditingForm] = useState<FormItem | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { register, handleSubmit, reset, formState: { errors } } = useForm<FormInputs>({ resolver: zodResolver(formSchema) });

    const { data: formsData, refetch } = useSuspenseQuery({
        queryKey: ['forms'],
        queryFn: async () => {
            const { data } = await getForms();
            if (data.status === 'DONE') {
                return data.body;
            }
            return { forms: [] };
        }
    });

    const handleDeleteForm = async (form: FormItem) => {
        const confirmed = await confirm({
            title: t({
                id: 'settings.forms.delete.title',
                message: 'Delete template'
            }),
            message: i18n._({
                id: 'settings.forms.delete.message',
                message: 'Delete “{title}”? This action cannot be undone.',
                values: { title: form.title }
            }),
            confirmText: t({
                id: 'common.delete',
                message: 'Delete'
            }),
            variant: 'danger'
        });

        if (!confirmed) return;

        try {
            const { data } = await deleteForm(form.id);

            if (data.status === 'DONE') {
                toast.success(t({
                    id: 'settings.forms.delete.success',
                    message: 'Template deleted.'
                }));
                refetch();
            } else {
                toast.error(data.errorMessage || t({
                    id: 'settings.forms.delete.failed',
                    message: 'Could not delete the template.'
                }));
            }
        } catch {
            toast.error(t({
                id: 'common.network_error',
                message: 'A network error occurred.'
            }));
        }
    };

    const handleCreateForm = () => {
        setEditingForm(null);
        reset({
            title: '',
            content: ''
        });
        setShowForm(true);
    };

    const handleEditForm = async (formId: number) => {
        try {
            const { data } = await getForm(formId);
            if (data.status === 'DONE') {
                setEditingForm(data.body);
                reset({
                    title: data.body.title,
                    content: data.body.content || ''
                });
                setShowForm(true);
            } else {
                toast.error(data.errorMessage || t({
                    id: 'settings.forms.load_detail_failed',
                    message: 'Could not load the template.'
                }));
            }
        } catch {
            toast.error(t({
                id: 'common.network_error',
                message: 'A network error occurred.'
            }));
        }
    };

    const onSubmit = async (formData: FormInputs) => {
        setIsSubmitting(true);
        try {
            if (editingForm) {
                const { data } = await updateForm(editingForm.id, {
                    title: formData.title,
                    content: formData.content
                });
                if (data.status === 'DONE') {
                    toast.success(t({
                        id: 'settings.forms.update.success',
                        message: 'Template updated.'
                    }));
                    closeForm();
                    refetch();
                } else {
                    toast.error(data.errorMessage || t({
                        id: 'settings.forms.update.failed',
                        message: 'Could not update the template.'
                    }));
                }
            } else {
                const { data } = await createForm({
                    title: formData.title,
                    content: formData.content
                });
                if (data.status === 'DONE') {
                    toast.success(t({
                        id: 'settings.forms.create.success',
                        message: 'Template created.'
                    }));
                    closeForm();
                    refetch();
                } else {
                    toast.error(data.errorMessage || t({
                        id: 'settings.forms.create.failed',
                        message: 'Could not create the template.'
                    }));
                }
            }
        } catch {
            toast.error(t({
                id: 'common.network_error',
                message: 'A network error occurred.'
            }));
        } finally {
            setIsSubmitting(false);
        }
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingForm(null);
        reset({
            title: '',
            content: ''
        });
    };

    const forms = formsData?.forms || [];
    const createAction = (
        <SettingsHeaderAction
            variant="primary"
            onClick={handleCreateForm}>
            <Trans id="settings.forms.add">Add template</Trans>
        </SettingsHeaderAction>
    );

    return (
        <div>
            <SettingsHeader
                title={i18n._({
                    id: 'settings.forms.title_count',
                    message: 'Templates ({count})',
                    values: { count: forms.length }
                })}
                description={t({
                    id: 'settings.forms.description',
                    message: 'Save reusable content to insert into new posts.'
                })}
                actionPosition="right"
                action={forms.length > 0 ? createAction : undefined}
            />

            {showForm && (
                <form
                    className="mb-6 bg-surface-subtle border border-line rounded-2xl p-6 animate-in fade-in-0 slide-in-from-top-2 motion-interaction"
                    onSubmit={handleSubmit(onSubmit)}>
                    <h3 className="text-base font-semibold text-content mb-4">
                        {editingForm
                            ? t({
                                id: 'settings.forms.editor.edit_title',
                                message: 'Edit template'
                            })
                            : t({
                                id: 'settings.forms.editor.add_title',
                                message: 'Add template'
                            })}
                    </h3>
                    <div className="space-y-4">
                        <Input
                            density="compact"
                            label={t({
                                id: 'settings.forms.fields.title',
                                message: 'Title'
                            })}
                            type="text"
                            placeholder={t({
                                id: 'settings.forms.fields.title_placeholder',
                                message: 'Enter a template title'
                            })}
                            error={errors.title?.message}
                            {...register('title')}
                        />

                        <Input
                            density="compact"
                            label={t({
                                id: 'settings.forms.fields.content',
                                message: 'Content'
                            })}
                            multiline
                            rows={8}
                            placeholder={t({
                                id: 'settings.forms.fields.content_placeholder',
                                message: 'Enter reusable content'
                            })}
                            error={errors.content?.message}
                            {...register('content')}
                        />

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
                                        ? editingForm
                                            ? t({
                                                id: 'settings.forms.update.updating',
                                                message: 'Updating...'
                                            })
                                            : t({
                                                id: 'settings.forms.create.creating',
                                                message: 'Creating...'
                                            })
                                        : editingForm
                                            ? t({
                                                id: 'settings.forms.update.action',
                                                message: 'Update template'
                                            })
                                            : t({
                                                id: 'settings.forms.create.action',
                                                message: 'Create template'
                                            })}
                                </Button>
                            </div>
                        </div>
                    </div>
                </form>
            )}

            {forms.length > 0 ? (
                <div className="space-y-3">
                    {forms.map((form) => (
                        <SettingsListItem
                            key={form.id}
                            left={
                                <div className={getSettingsIconClass('default')}>
                                    <FileText aria-hidden className="h-4 w-4" />
                                </div>
                            }
                            actions={
                                <Dropdown
                                    density="compact"
                                    triggerAriaLabel={i18n._({
                                        id: 'settings.forms.open_menu',
                                        message: 'Open template menu: {title}',
                                        values: { title: form.title }
                                    })}
                                    triggerClassName="min-h-11 min-w-11 [@media(pointer:fine)]:min-h-9 [@media(pointer:fine)]:min-w-9"
                                    items={[
                                        {
                                            label: t({
                                                id: 'common.edit',
                                                message: 'Edit'
                                            }),
                                            icon: <Pencil aria-hidden className="h-4 w-4" />,
                                            onClick: () => handleEditForm(form.id)
                                        },
                                        {
                                            label: t({
                                                id: 'common.delete',
                                                message: 'Delete'
                                            }),
                                            icon: <Trash2 aria-hidden className="h-4 w-4" />,
                                            onClick: () => handleDeleteForm(form),
                                            variant: 'danger'
                                        }
                                    ]}
                                />
                            }>
                            <h3 className={SETTINGS_LIST_TITLE}>{form.title}</h3>
                        </SettingsListItem>
                    ))}
                </div>
            ) : !showForm ? (
                <SettingsEmptyState
                    icon={<FileText aria-hidden className="h-5 w-5" />}
                    title={t({
                        id: 'settings.forms.empty',
                        message: 'No templates yet'
                    })}
                    action={createAction}
                />
            ) : null}
        </div>
    );
};

export default FormsManagement;
