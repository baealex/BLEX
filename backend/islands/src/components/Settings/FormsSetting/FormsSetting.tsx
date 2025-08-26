import React from 'react';
import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';
import { useFetch } from '~/hooks/use-fetch';
import type { Response } from '~/modules/http.module';

interface FormItem {
    id: number;
    title: string;
}

interface FormsData {
    forms: FormItem[];
}

const FormsManagement: React.FC = () => {
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
        } catch (error) {
            notification('네트워크 오류가 발생했습니다.', { type: 'error' });
        }
    };

    const handleCreateForm = () => {
        window.location.href = '/forms/create';
    };

    const handleEditForm = (formId: number) => {
        window.location.href = `/forms/${formId}/edit`;
    };

    if (isLoading) {
        return (
            <div className="p-6 bg-white shadow-md rounded-lg">
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

    const forms = formsData?.forms || [];

    return (
        <div className="p-4 sm:p-6 bg-white shadow-md rounded-lg">
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
                            <div key={form.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between">
                                    <button
                                        type="button"
                                        className="flex-1 text-left text-gray-900 font-medium hover:text-blue-600 transition-colors focus:outline-none focus:text-blue-600"
                                        onClick={() => handleEditForm(form.id)}>
                                        <div className="flex items-center">
                                            <i className="fas fa-edit mr-2 text-gray-400" />
                                            {form.title}
                                        </div>
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
                )}
            </div>
        </div>
    );
};

export default FormsManagement;
