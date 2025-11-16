import React, { useState } from 'react';
import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';
import { useFetch } from '~/hooks/use-fetch';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Response } from '~/modules/http.module';
import { Button, Input, LoadingState } from '~/components/shared';

interface FormItem {
    id: number;
    title: string;
    content?: string;
}

interface FormsData {
    forms: FormItem[];
}

const formSchema = z.object({
    title: z.string().min(1, '제목을 입력해주세요.').max(100, '제목은 100자 이내로 입력해주세요.'),
    content: z.string().min(1, '내용을 입력해주세요.')
});

type FormInputs = z.infer<typeof formSchema>;

const FormsManagement: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingForm, setEditingForm] = useState<FormItem | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { register, handleSubmit, reset, formState: { errors } } = useForm<FormInputs>({ resolver: zodResolver(formSchema) });

    const { data: formsData, isLoading, refetch } = useFetch({
        queryKey: ['forms'],
        queryFn: async () => {
            const { data } = await http.get<Response<FormsData>>('/v1/forms');
            if (data.status === 'DONE') {
                return data.body;
            }
            return { forms: [] };
        }
    });

    const handleDeleteForm = async (formId: number) => {
        if (!confirm('정말 이 서식을 삭제할까요?')) {
            return;
        }

        try {
            const { data } = await http.delete(`/v1/forms/${formId}`);

            if (data.status === 'DONE') {
                notification('서식이 삭제되었습니다.', { type: 'success' });
                refetch();
            } else {
                notification('서식 삭제에 실패했습니다.', { type: 'error' });
            }
        } catch {
            notification('네트워크 오류가 발생했습니다.', { type: 'error' });
        }
    };

    const handleCreateForm = () => {
        setEditingForm(null);
        reset({ title: '', content: '' });
        setIsModalOpen(true);
    };

    const handleEditForm = async (formId: number) => {
        try {
            const { data } = await http.get<Response<FormItem>>(`/v1/forms/${formId}`);
            if (data.status === 'DONE') {
                setEditingForm(data.body);
                reset({
                    title: data.body.title,
                    content: data.body.content || ''
                });
                setIsModalOpen(true);
            } else {
                notification('서식을 불러오는데 실패했습니다.', { type: 'error' });
            }
        } catch {
            notification('네트워크 오류가 발생했습니다.', { type: 'error' });
        }
    };

    const onSubmit = async (formData: FormInputs) => {
        setIsSubmitting(true);
        try {
            if (editingForm) {
                const { data } = await http.put(`/v1/forms/${editingForm.id}`, formData);
                if (data.status === 'DONE') {
                    notification('서식이 수정되었습니다.', { type: 'success' });
                    setIsModalOpen(false);
                    refetch();
                } else {
                    notification('서식 수정에 실패했습니다.', { type: 'error' });
                }
            } else {
                const { data } = await http.post('/v1/forms', formData);
                if (data.status === 'DONE') {
                    notification('서식이 생성되었습니다.', { type: 'success' });
                    setIsModalOpen(false);
                    refetch();
                } else {
                    notification('서식 생성에 실패했습니다.', { type: 'error' });
                }
            }
        } catch {
            notification('네트워크 오류가 발생했습니다.', { type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingForm(null);
        reset({ title: '', content: '' });
    };

    if (isLoading) {
        return <LoadingState type="list" rows={3} />;
    }

    const forms = formsData?.forms || [];

    return (
        <div className="p-6 bg-white shadow-sm rounded-2xl border border-gray-200">
            {/* Header Section */}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">서식 관리</h2>
                <p className="text-gray-600 mb-6">자주 사용하는 서식을 미리 만들어두면, 글을 더 빠르게 작성할 수 있어요.</p>

                <Button
                    variant="primary"
                    size="md"
                    fullWidth
                    leftIcon={<i className="fas fa-plus" />}
                    onClick={handleCreateForm}>
                    서식 추가
                </Button>
            </div>

            {/* Forms List */}
            {forms.length === 0 ? (
                <div className="text-center py-16">
                    <div className="w-20 h-20 mx-auto bg-gray-100 rounded-2xl flex items-center justify-center mb-6">
                        <i className="far fa-file-alt text-gray-400 text-3xl" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">서식이 없습니다</h3>
                    <p className="text-gray-500">서식 추가 버튼을 눌러 첫 번째 서식을 만들어보세요.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {forms.map((form) => (
                        <div key={form.id} className="bg-gray-50 border border-gray-200 rounded-2xl p-4 hover:bg-gray-100 hover:shadow-sm transition-all duration-300">
                            <div className="flex items-center justify-between gap-3">
                                <button
                                    type="button"
                                    className="flex-1 text-left text-gray-900 font-semibold hover:text-gray-600 transition-colors focus:outline-none"
                                    onClick={() => handleEditForm(form.id)}>
                                    {form.title}
                                </button>
                                <div className="flex gap-2">
                                    <Button
                                        variant="secondary"
                                        size="md"
                                        onClick={() => handleEditForm(form.id)}>
                                        <i className="fas fa-edit" />
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        size="md"
                                        onClick={() => handleDeleteForm(form.id)}>
                                        <i className="fas fa-trash" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
                        <div className="flex items-center justify-between p-6 border-b border-gray-200">
                            <h3 className="text-xl font-bold text-gray-900">
                                {editingForm ? '서식 편집' : '서식 추가'}
                            </h3>
                            <button
                                type="button"
                                className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
                                onClick={closeModal}>
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="overflow-y-auto max-h-[calc(90vh-140px)]">
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
                    </div>
                </div>
            )}
        </div>
    );
};

export default FormsManagement;
