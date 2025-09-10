import React, { useState } from 'react';
import { settingsApi } from '~/api/settings';
import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';
import { useFetch } from '~/hooks/use-fetch';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Response } from '~/modules/http.module';


const formSchema = z.object({
    title: z.string().min(1, '제목을 입력해주세요.').max(100, '제목은 100자 이내로 입력해주세요.'),
    content: z.string().min(1, '내용을 입력해주세요.')
});

type FormInputs = z.infer<typeof formSchema>;

const FormsManagement: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingForm, setEditingForm] = useState<{ id: number; title: string; content?: string } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { register, handleSubmit, reset, formState: { errors } } = useForm<FormInputs>({ resolver: zodResolver(formSchema) });

    const { data: formsData, isLoading, refetch } = useFetch({
        queryKey: ['forms'],
        queryFn: () => settingsApi.getForms()
    });

    const handleDeleteForm = async (formId: number) => {
        if (!confirm('정말 이 서식을 삭제할까요?')) {
            return;
        }

        try {
            const data = await settingsApi.deleteForm(formId.toString());

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
        reset({
            title: '',
            content: ''
        });
        setIsModalOpen(true);
    };

    const handleEditForm = async (formId: number) => {
        try {
            // This would need a getFormById method in settingsApi
            const { data } = await http.get<Response<{ id: number; title: string; content?: string }>>(`/v1/forms/${formId}`);
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
            let data;
            if (editingForm) {
                data = await settingsApi.updateForm(editingForm.id.toString(), { name: formData.title, description: formData.content });
                if (data.status === 'DONE') {
                    notification('서식이 수정되었습니다.', { type: 'success' });
                    setIsModalOpen(false);
                    refetch();
                } else {
                    notification('서식 수정에 실패했습니다.', { type: 'error' });
                }
            } else {
                data = await settingsApi.createForm({ name: formData.title, description: formData.content });
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
        reset({
            title: '',
            content: ''
        });
    };

    if (isLoading) {
        return (
            <div className="p-6 bg-white shadow-sm rounded-lg">
                <div className="animate-pulse">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-6">
                        <div className="h-6 bg-gray-200 rounded w-32 mb-2" />
                        <div className="h-4 bg-gray-200 rounded w-64" />
                    </div>
                    <div className="space-y-3">
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <div className="h-10 bg-gray-200 rounded" />
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <div className="h-12 bg-gray-200 rounded" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const forms = formsData?.forms?.map(f => ({ id: parseInt(f.id), title: f.name, content: f.description })) || [];

    return (
        <div className="p-4 sm:p-6 bg-white shadow-sm rounded-lg">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-blue-900 mb-2">서식 관리</h2>
                <p className="text-blue-700">자주 사용하는 서식을 미리 만들어두면, 글을 더 빠르게 작성할 수 있을거예요.</p>
            </div>

            {/* Add Form Button */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
                <button
                    type="button"
                    className="w-full inline-flex justify-center items-center py-3 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors touch-manipulation min-h-[48px]"
                    onClick={handleCreateForm}>
                    <i className="fas fa-plus mr-2" />
                    서식 추가
                </button>
            </div>

            {/* Forms List */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <i className="fas fa-list mr-2 text-gray-500" />
                    저장된 서식
                </h3>

                {forms.length === 0 ? (
                    <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-6 rounded-md text-center">
                        <i className="far fa-file-alt text-4xl mb-3 text-blue-400" />
                        <p className="font-medium">아직 작성된 서식이 없습니다</p>
                        <p className="text-sm mt-1">서식 추가 버튼을 눌러 첫 번째 서식을 만들어보세요.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {forms.map((form) => (
                            <div key={form.id} className="bg-white border border-gray-200 rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                    <button
                                        type="button"
                                        className="flex-1 text-left text-gray-900 font-medium hover:text-blue-600 transition-colors focus:outline-none focus:text-blue-600"
                                        onClick={() => handleEditForm(form.id)}>
                                        {form.title}
                                    </button>
                                    <button
                                        type="button"
                                        className="ml-4 inline-flex items-center p-2 border border-transparent text-sm font-medium rounded-md text-red-600 hover:text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                                        onClick={() => handleDeleteForm(form.id)}
                                        title="서식 삭제">
                                        <i className="fas fa-trash" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )
                }
            </div >

            {/* Modal */}
            {
                isModalOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
                            <div className="flex items-center justify-between p-6 border-b border-gray-200">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    {editingForm ? '서식 편집' : '서식 추가'}
                                </h3>
                                <button
                                    type="button"
                                    className="text-gray-400 hover:text-gray-500 focus:outline-none focus:text-gray-500 transition-colors"
                                    onClick={closeModal}>
                                    <i className="fas fa-times text-xl" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit(onSubmit)} className="overflow-y-auto max-h-[calc(90vh-140px)]">
                                <div className="p-6 space-y-4">
                                    <div>
                                        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                                            제목
                                        </label>
                                        <input
                                            id="title"
                                            type="text"
                                            className="block w-full rounded-md border border-solid border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm p-3 transition-colors"
                                            placeholder="서식 제목을 입력하세요"
                                            {...register('title')}
                                        />
                                        {errors.title && (
                                            <p className="text-red-500 text-xs mt-1 flex items-center">
                                                <i className="fas fa-exclamation-circle mr-1" />
                                                {errors.title.message}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
                                            내용
                                        </label>
                                        <textarea
                                            id="content"
                                            rows={12}
                                            className="block w-full rounded-md border border-solid border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm p-3 transition-colors resize-y"
                                            placeholder="서식 내용을 입력하세요"
                                            {...register('content')}
                                        />
                                        {errors.content && (
                                            <p className="text-red-500 text-xs mt-1 flex items-center">
                                                <i className="fas fa-exclamation-circle mr-1" />
                                                {errors.content.message}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                                    <button
                                        type="button"
                                        className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                                        onClick={closeModal}
                                        disabled={isSubmitting}>
                                        취소
                                    </button>
                                    <button
                                        type="submit"
                                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        disabled={isSubmitting}>
                                        {isSubmitting ? (
                                            <>
                                                <i className="fas fa-spinner fa-spin mr-2" />
                                                {editingForm ? '수정 중...' : '생성 중...'}
                                            </>
                                        ) : (
                                            <>
                                                <i className={`fas ${editingForm ? 'fa-save' : 'fa-plus'} mr-2`} />
                                                {editingForm ? '수정' : '생성'}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default FormsManagement;
