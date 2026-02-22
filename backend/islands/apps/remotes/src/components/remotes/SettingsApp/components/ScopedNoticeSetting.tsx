import { useState } from 'react';
import type { ReactNode } from 'react';
import type { AxiosResponse } from 'axios';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { toast } from '~/utils/toast';
import { useConfirm } from '~/hooks/useConfirm';
import {
    Button,
    Checkbox,
    Dropdown,
    Input,
    Modal,
    TITLE
} from '~/components/shared';
import type { Response } from '~/lib/http.module';
import { SettingsEmptyState, SettingsHeader, SettingsListItem } from '.';

interface NoticeLike {
    id: number;
    title: string;
    url: string;
    isActive: boolean;
}

interface ScopedNoticeSettingProps<
    TNotice extends NoticeLike,
    TCreateData extends { title: string; url: string; is_active?: boolean },
    TUpdateData extends Partial<TCreateData>
> {
    queryKey: string[];
    title: string;
    description: string;
    emptyTitle: string;
    emptyDescription: string;
    activeDescription: string;
    fetchNotices: () => Promise<AxiosResponse<Response<{ notices: TNotice[] }>>>;
    createNotice: (data: TCreateData) => Promise<AxiosResponse<Response<unknown>>>;
    updateNotice: (id: number, data: TUpdateData) => Promise<AxiosResponse<Response<unknown>>>;
    deleteNotice: (id: number) => Promise<AxiosResponse<Response<unknown>>>;
    toCreateData: (values: { title: string; url: string; isActive: boolean }) => TCreateData;
    toUpdateData: (values: { title: string; url: string; isActive: boolean }) => TUpdateData;
    toggleUpdateData: (notice: TNotice) => TUpdateData;
    createSuccessMessage: string;
    createErrorMessage: string;
    updateSuccessMessage: string;
    updateErrorMessage: string;
    deleteSuccessMessage: string;
    deleteErrorMessage: string;
    deleteConfirmTitle: string;
    deleteConfirmMessage: string;
    actionLabel?: string;
    itemExtraBadge?: (notice: TNotice) => ReactNode;
}

const ScopedNoticeSetting = <
    TNotice extends NoticeLike,
    TCreateData extends { title: string; url: string; is_active?: boolean },
    TUpdateData extends Partial<TCreateData>
>({
    queryKey,
    title,
    description,
    emptyTitle,
    emptyDescription,
    activeDescription,
    fetchNotices,
    createNotice,
    updateNotice,
    deleteNotice,
    toCreateData,
    toUpdateData,
    toggleUpdateData,
    createSuccessMessage,
    createErrorMessage,
    updateSuccessMessage,
    updateErrorMessage,
    deleteSuccessMessage,
    deleteErrorMessage,
    deleteConfirmTitle,
    deleteConfirmMessage,
    actionLabel = '새 공지 추가',
    itemExtraBadge
}: ScopedNoticeSettingProps<TNotice, TCreateData, TUpdateData>) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingNotice, setEditingNotice] = useState<TNotice | null>(null);
    const [formTitle, setFormTitle] = useState('');
    const [formUrl, setFormUrl] = useState('');
    const [formIsActive, setFormIsActive] = useState(true);
    const { confirm } = useConfirm();
    const queryClient = useQueryClient();

    const { data: noticesData } = useSuspenseQuery({
        queryKey,
        queryFn: async () => {
            const { data } = await fetchNotices();
            if (data.status === 'DONE') {
                return data.body.notices;
            }
            throw new Error('공지 목록을 불러오는데 실패했습니다.');
        }
    });

    const createMutation = useMutation({
        mutationFn: (data: TCreateData) => createNotice(data),
        onSuccess: () => {
            toast.success(createSuccessMessage);
            queryClient.invalidateQueries({ queryKey });
            closeModal();
        },
        onError: () => {
            toast.error(createErrorMessage);
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: TUpdateData }) => updateNotice(id, data),
        onSuccess: () => {
            toast.success(updateSuccessMessage);
            queryClient.invalidateQueries({ queryKey });
            closeModal();
        },
        onError: () => {
            toast.error(updateErrorMessage);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => deleteNotice(id),
        onSuccess: () => {
            toast.success(deleteSuccessMessage);
            queryClient.invalidateQueries({ queryKey });
        },
        onError: () => {
            toast.error(deleteErrorMessage);
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formTitle.trim() || !formUrl.trim()) return;

        const values = {
            title: formTitle,
            url: formUrl,
            isActive: formIsActive
        };

        if (editingNotice) {
            updateMutation.mutate({
                id: editingNotice.id,
                data: toUpdateData(values)
            });
        } else {
            createMutation.mutate(toCreateData(values));
        }
    };

    const handleDelete = async (id: number) => {
        const confirmed = await confirm({
            title: deleteConfirmTitle,
            message: deleteConfirmMessage,
            confirmText: '삭제'
        });

        if (confirmed) {
            deleteMutation.mutate(id);
        }
    };

    const handleEdit = (notice: TNotice) => {
        setEditingNotice(notice);
        setFormTitle(notice.title);
        setFormUrl(notice.url);
        setFormIsActive(notice.isActive);
        setIsModalOpen(true);
    };

    const handleToggleActive = (notice: TNotice) => {
        updateMutation.mutate({
            id: notice.id,
            data: toggleUpdateData(notice)
        });
    };

    const handleCreate = () => {
        setEditingNotice(null);
        setFormTitle('');
        setFormUrl('');
        setFormIsActive(true);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingNotice(null);
    };

    return (
        <div className="space-y-8">
            <SettingsHeader
                title={`${title} (${noticesData?.length || 0})`}
                description={description}
                actionPosition="right"
                action={
                    <Button
                        onClick={handleCreate}
                        variant="primary"
                        size="md"
                        className="w-full sm:w-auto">
                        {actionLabel}
                    </Button>
                }
            />

            {noticesData && noticesData.length > 0 ? (
                <div className="space-y-3">
                    {noticesData.map((notice) => (
                        <SettingsListItem
                            key={notice.id}
                            onClick={() => handleEdit(notice)}
                            actions={
                                <Dropdown
                                    items={[
                                        {
                                            label: notice.isActive ? '비활성화' : '활성화',
                                            icon: 'fas fa-power-off',
                                            onClick: () => handleToggleActive(notice)
                                        },
                                        {
                                            label: '수정',
                                            icon: 'fas fa-pen',
                                            onClick: () => handleEdit(notice)
                                        },
                                        {
                                            label: '삭제',
                                            icon: 'fas fa-trash',
                                            onClick: () => handleDelete(notice.id),
                                            variant: 'danger'
                                        }
                                    ]}
                                />
                            }>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className={`${TITLE} mb-0`}>{notice.title}</h3>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${notice.isActive ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-50 text-gray-500 border-gray-100'}`}>
                                        {notice.isActive ? '활성' : '비활성'}
                                    </span>
                                    {itemExtraBadge?.(notice)}
                                </div>
                                <p className="text-sm text-gray-500 truncate max-w-md">{notice.url}</p>
                            </div>
                        </SettingsListItem>
                    ))}
                </div>
            ) : (
                <SettingsEmptyState
                    iconClassName="fas fa-bullhorn"
                    title={emptyTitle}
                    description={emptyDescription}
                />
            )}

            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={editingNotice ? '공지 수정' : '새 공지 만들기'}
                maxWidth="lg">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-6">
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-gray-900">
                                공지 제목
                            </label>
                            <Input
                                placeholder="공지 제목을 입력하세요"
                                value={formTitle}
                                onChange={(e) => setFormTitle(e.target.value)}
                                className="text-base"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-gray-900">
                                URL
                            </label>
                            <Input
                                placeholder="https://example.com/notice"
                                value={formUrl}
                                onChange={(e) => setFormUrl(e.target.value)}
                                className="text-base"
                            />
                            <p className="text-xs text-gray-500">공지 클릭 시 이동할 URL입니다.</p>
                        </div>

                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                            <Checkbox
                                checked={formIsActive}
                                onCheckedChange={(checked) => setFormIsActive(checked)}
                                label="공지 활성화"
                                description={activeDescription}
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                        <Button
                            type="button"
                            variant="secondary"
                            size="md"
                            onClick={closeModal}
                            disabled={createMutation.isPending || updateMutation.isPending}>
                            취소
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            size="md"
                            isLoading={createMutation.isPending || updateMutation.isPending}>
                            {createMutation.isPending || updateMutation.isPending ? '저장 중...' : editingNotice ? '공지 수정' : '공지 생성'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default ScopedNoticeSetting;
