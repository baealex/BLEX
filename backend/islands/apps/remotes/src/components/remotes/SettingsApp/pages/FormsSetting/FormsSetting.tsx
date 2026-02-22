import { useState } from 'react';
import { toast } from '~/utils/toast';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { SettingsEmptyState, SettingsHeader, SettingsListItem } from '../../components';
import { Button, Input, Dropdown } from '~/components/shared';
import {
    getIconClass,
    TITLE
} from '~/components/shared';
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

const formSchema = z.object({
    title: z.string().min(1, '제목을 입력해주세요.').max(100, '제목은 100자 이내로 입력해주세요.'),
    content: z.string().min(1, '내용을 입력해주세요.')
});

type FormInputs = z.infer<typeof formSchema>;

const FormsManagement = () => {
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

    const handleDeleteForm = async (formId: number) => {
        const confirmed = await confirm({
            title: '서식 삭제',
            message: '정말 이 서식을 삭제할까요?',
            confirmText: '삭제',
            variant: 'danger'
        });

        if (!confirmed) return;

        try {
            const { data } = await deleteForm(formId);

            if (data.status === 'DONE') {
                toast.success('서식이 삭제되었습니다.');
                refetch();
            } else {
                toast.error('서식 삭제에 실패했습니다.');
            }
        } catch {
            toast.error('네트워크 오류가 발생했습니다.');
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
                toast.error('서식을 불러오는데 실패했습니다.');
            }
        } catch {
            toast.error('네트워크 오류가 발생했습니다.');
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
                    toast.success('서식이 수정되었습니다.');
                    closeForm();
                    refetch();
                } else {
                    toast.error('서식 수정에 실패했습니다.');
                }
            } else {
                const { data } = await createForm({
                    title: formData.title,
                    content: formData.content
                });
                if (data.status === 'DONE') {
                    toast.success('서식이 생성되었습니다.');
                    closeForm();
                    refetch();
                } else {
                    toast.error('서식 생성에 실패했습니다.');
                }
            }
        } catch {
            toast.error('네트워크 오류가 발생했습니다.');
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

    return (
        <div>
            <SettingsHeader
                title="서식 관리"
                description="자주 사용하는 서식을 미리 만들어두면, 글을 더 빠르게 작성할 수 있어요."
                actionPosition="right"
                action={
                    <Button
                        variant="primary"
                        size="md"
                        className="w-full sm:w-auto"
                        onClick={handleCreateForm}>
                        새 서식 추가
                    </Button>
                }
            />

            {showForm && (
                <form
                    className="mb-6 bg-gray-50 border border-gray-200 rounded-2xl p-6 animate-in fade-in-0 slide-in-from-top-2 motion-interaction"
                    onSubmit={handleSubmit(onSubmit)}>
                    <h3 className="text-base font-semibold text-gray-900 mb-4">
                        {editingForm ? '서식 편집' : '서식 추가'}
                    </h3>
                    <div className="space-y-4">
                        <Input
                            label="제목"
                            type="text"
                            placeholder="서식 제목을 입력하세요"
                            error={errors.title?.message}
                            {...register('title')}
                        />

                        <Input
                            label="내용"
                            multiline
                            rows={8}
                            placeholder="서식 내용을 입력하세요"
                            error={errors.content?.message}
                            {...register('content')}
                        />

                        <div className="flex items-center justify-between gap-3">
                            <Button
                                type="button"
                                variant="ghost"
                                size="md"
                                onClick={closeForm}
                                disabled={isSubmitting}>
                                취소
                            </Button>
                            <div className="flex items-center gap-3">
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="md"
                                    isLoading={isSubmitting}>
                                    {isSubmitting ? (editingForm ? '수정 중...' : '생성 중...') : (editingForm ? '서식 수정' : '서식 생성')}
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
                            onClick={() => handleEditForm(form.id)}
                            left={
                                <div className={getIconClass('default')}>
                                    <i className="fas fa-file-lines text-sm" />
                                </div>
                            }
                            actions={
                                <Dropdown
                                    items={[
                                        {
                                            label: '삭제',
                                            icon: 'fas fa-trash',
                                            onClick: () => handleDeleteForm(form.id),
                                            variant: 'danger'
                                        }
                                    ]}
                                />
                            }>
                            <h3 className={TITLE}>{form.title}</h3>
                        </SettingsListItem>
                    ))}
                </div>
            ) : (
                <SettingsEmptyState
                    iconClassName="fas fa-file-lines"
                    title="등록된 서식이 없습니다"
                    description="자주 사용하는 서식을 추가해보세요."
                />
            )}
        </div>
    );
};

export default FormsManagement;
