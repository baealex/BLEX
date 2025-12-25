import { useState } from 'react';
import { toast } from '~/utils/toast';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { SettingsHeader } from '../components';
import { Button, Input, Modal, Dropdown } from '~/components/shared';
import {
 getCardClass,
 getIconClass,
 CARD_PADDING,
 FLEX_ROW,
 TITLE,
 ACTIONS_CONTAINER
} from '~/components/shared';
import { useConfirm } from '~/contexts/ConfirmContext';
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
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingForm, setEditingForm] = useState<FormItem | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { register, handleSubmit, reset, formState: { errors } } = useForm<FormInputs>({ resolver: zodResolver(formSchema) });

    const { data: formsData, isLoading, refetch } = useQuery({
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
        setIsModalOpen(true);
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
                setIsModalOpen(true);
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
                    setIsModalOpen(false);
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
                    setIsModalOpen(false);
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

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingForm(null);
        reset({
            title: '',
            content: ''
        });
    };

    if (isLoading) {
        return null;
    }

    const forms = formsData?.forms || [];

    return (
        <div>
            <SettingsHeader
                title="서식 관리"
                description="자주 사용하는 서식을 미리 만들어두면, 글을 더 빠르게 작성할 수 있어요."
                action={
                    <Button
                        variant="primary"
                        size="md"
                        fullWidth
                        leftIcon={<i className="fas fa-plus" />}
                        onClick={handleCreateForm}>
                        새 서식 추가
                    </Button>
                }
            />

            {/* Forms List */}
            {forms.length > 0 && (
                <div className="space-y-3">
                    {forms.map((form) => (
                        <div key={form.id} className={getCardClass()}>
                            <div className={CARD_PADDING}>
                                <div className={FLEX_ROW}>
                                    {/* Icon */}
                                    <div className={getIconClass('default')}>
                                        <i className="fas fa-file-lines text-sm" />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleEditForm(form.id)}>
                                        <h3 className={TITLE}>{form.title}</h3>
                                    </div>

                                    {/* Actions */}
                                    <div className={ACTIONS_CONTAINER}>
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
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={editingForm ? '서식 편집' : '서식 추가'}
                maxWidth="2xl">
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="p-6 space-y-6">
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
                            rows={12}
                            placeholder="서식 내용을 입력하세요"
                            error={errors.content?.message}
                            {...register('content')}
                        />
                    </div>

                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                        <Button
                            variant="secondary"
                            size="md"
                            onClick={closeModal}
                            disabled={isSubmitting}>
                            취소
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            size="md"
                            isLoading={isSubmitting}
                            leftIcon={!isSubmitting ? <i className={`fas ${editingForm ? 'fa-save' : 'fa-plus'}`} /> : undefined}>
                            {isSubmitting ? (editingForm ? '수정 중...' : '생성 중...') : (editingForm ? '수정' : '생성')}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default FormsManagement;
