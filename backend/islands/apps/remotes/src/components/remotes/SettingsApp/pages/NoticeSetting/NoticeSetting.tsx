import { useState } from 'react';
import { toast } from '~/utils/toast';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useConfirm } from '~/hooks/useConfirm';
import { SettingsEmptyState, SettingsHeader, SettingsListItem } from '../../components';
import {
    Button, Checkbox, Dropdown, Input, Modal, TITLE
} from '~/components/shared';
import {
    getNotices,
    createNotice,
    updateNotice,
    deleteNotice,
    type NoticeData,
    type NoticeCreateData,
    type NoticeUpdateData
} from '~/lib/api/settings';

const NoticeSetting = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingNotice, setEditingNotice] = useState<NoticeData | null>(null);
    const [formTitle, setFormTitle] = useState('');
    const [formUrl, setFormUrl] = useState('');
    const [formIsActive, setFormIsActive] = useState(true);
    const { confirm } = useConfirm();
    const queryClient = useQueryClient();

    const { data: noticesData } = useSuspenseQuery({
        queryKey: ['notices'],
        queryFn: async () => {
            const { data } = await getNotices();
            if (data.status === 'DONE') {
                return data.body.notices;
            }
            throw new Error('공지 목록을 불러오는데 실패했습니다.');
        }
    });

    const createMutation = useMutation({
        mutationFn: (data: NoticeCreateData) => createNotice(data),
        onSuccess: () => {
            toast.success('공지가 생성되었습니다.');
            queryClient.invalidateQueries({ queryKey: ['notices'] });
            closeModal();
        },
        onError: () => {
            toast.error('공지 생성에 실패했습니다.');
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: NoticeUpdateData }) => updateNotice(id, data),
        onSuccess: () => {
            toast.success('공지가 수정되었습니다.');
            queryClient.invalidateQueries({ queryKey: ['notices'] });
            closeModal();
        },
        onError: () => {
            toast.error('공지 수정에 실패했습니다.');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => deleteNotice(id),
        onSuccess: () => {
            toast.success('공지가 삭제되었습니다.');
            queryClient.invalidateQueries({ queryKey: ['notices'] });
        },
        onError: () => {
            toast.error('공지 삭제에 실패했습니다.');
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formTitle.trim() || !formUrl.trim()) return;

        if (editingNotice) {
            updateMutation.mutate({
                id: editingNotice.id,
                data: {
                    title: formTitle,
                    url: formUrl,
                    is_active: formIsActive
                }
            });
        } else {
            createMutation.mutate({
                title: formTitle,
                url: formUrl,
                is_active: formIsActive
            });
        }
    };

    const handleDelete = async (id: number) => {
        const confirmed = await confirm({
            title: '공지 삭제',
            message: '정말로 이 공지를 삭제하시겠습니까?',
            confirmText: '삭제'
        });

        if (confirmed) {
            deleteMutation.mutate(id);
        }
    };

    const handleEdit = (notice: NoticeData) => {
        setEditingNotice(notice);
        setFormTitle(notice.title);
        setFormUrl(notice.url);
        setFormIsActive(notice.isActive);
        setIsModalOpen(true);
    };

    const handleToggleActive = (notice: NoticeData) => {
        updateMutation.mutate({
            id: notice.id,
            data: { is_active: !notice.isActive }
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
                title={`공지 관리 (${noticesData?.length || 0})`}
                description="블로그에 표시되는 공지를 관리합니다."
                actionPosition="right"
                action={
                    <Button
                        onClick={handleCreate}
                        variant="primary"
                        size="md"
                        className="w-full sm:w-auto">
                        새 공지 추가
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
                                </div>
                                <p className="text-sm text-gray-500 truncate max-w-md">{notice.url}</p>
                            </div>
                        </SettingsListItem>
                    ))}
                </div>
            ) : (
                <SettingsEmptyState
                    iconClassName="fas fa-bullhorn"
                    title="등록된 공지가 없습니다"
                    description="첫 번째 공지를 만들어보세요."
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
                                description="활성화된 공지만 블로그에 표시됩니다."
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

export default NoticeSetting;
