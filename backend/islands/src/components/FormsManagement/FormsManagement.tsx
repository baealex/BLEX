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

interface FormsManagementProps {
    forms?: FormItem[];
}

const FormsManagement: React.FC<FormsManagementProps> = ({ forms: initialForms = [] }) => {
    const { data: formsData, isLoading, refetch } = useFetch({
        queryKey: ['forms'],
        queryFn: async () => {
            // If we have initial forms data, use it
            if (initialForms.length > 0) {
                return { forms: initialForms };
            }

            // Otherwise fetch from API
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
            <div
                style={{
                    textAlign: 'center',
                    padding: '2rem'
                }}>
                <div className="spinner-border" role="status">
                    <span className="visually-hidden">로딩중...</span>
                </div>
            </div>
        );
    }

    const forms = formsData?.forms || [];

    return (
        <div className="forms-management">
            <div className="alert alert-warning mb-3">
                자주 사용하는 서식을 미리 만들어두면, 글을 더 빠르게 작성할 수 있을거예요.
            </div>

            <button
                type="button"
                className="btn btn-primary w-100 mb-3"
                onClick={handleCreateForm}>
                서식 추가
            </button>

            <div id="forms-container">
                {forms.length === 0 ? (
                    <div className="alert alert-info">
                        아직 작성된 서식이 없습니다.
                    </div>
                ) : (
                    forms.map((form) => (
                        <div key={form.id} className="card setting-card mb-3">
                            <div className="card-body">
                                <div className="d-flex justify-content-between align-items-center">
                                    <button
                                        type="button"
                                        className="text-decoration-none text-dark btn btn-link p-0"
                                        style={{ textAlign: 'left' }}
                                        onClick={() => handleEditForm(form.id)}>
                                        {form.title}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-outline-danger btn-sm"
                                        onClick={() => handleDeleteForm(form.id)}>
                                        <i className="fas fa-times" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default FormsManagement;
