import { useState } from 'react';
import { toast } from '~/utils/toast';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useConfirm } from '~/hooks/useConfirm';
import { SettingsEmptyState, SettingsHeader, SettingsListItem } from '../../components';
import {
    Button,
    Checkbox,
    Dropdown,
    Input,
    Modal,
    TITLE
} from '~/components/shared';
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

const noticeSchema = z.object({
    title: z.string().trim().min(1, '공지 제목을 입력해주세요.').max(200, '공지 제목은 200자 이내여야 합니다.'),
    url: z.string().trim().min(1, 'URL을 입력해주세요.').url('올바른 URL 형식으로 입력해주세요.'),
    isActive: z.boolean()
});

type NoticeFormInputs = z.infer<typeof noticeSchema>;

const defaultValues: NoticeFormInputs = {
    title: '',
    url: '',
    isActive: true
};

const NoticeSettingBase = ({ scope }: NoticeSettingBaseProps) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingNotice, setEditingNotice] = useState<NoticeItem | null>(null);
    const { confirm } = useConfirm();
    const queryClient = useQueryClient();
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
    const noticeLabel = isGlobal ? '글로벌 공지' : '공지';

    const { data: noticesData } = useSuspenseQuery({
        queryKey,
        queryFn: async () => {
            const { data } = isGlobal ? await getGlobalNotices() : await getNotices();
            if (data.status === 'DONE') {
                return data.body.notices as NoticeItem[];
            }
            throw new Error('공지 목록을 불러오는데 실패했습니다.');
        }
    });

    const createMutation = useMutation({
        mutationFn: (data: NoticeCreatePayload) => (
            isGlobal
                ? createGlobalNotice(data as GlobalNoticeCreateData)
                : createNotice(data as NoticeCreateData)
        ),
        onSuccess: () => {
            toast.success(`${noticeLabel}가 생성되었습니다.`);
            queryClient.invalidateQueries({ queryKey });
            closeModal();
        },
        onError: () => {
            toast.error(`${noticeLabel} 생성에 실패했습니다.`);
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: NoticeUpdatePayload }) => (
            isGlobal
                ? updateGlobalNotice(id, data as GlobalNoticeUpdateData)
                : updateNotice(id, data as NoticeUpdateData)
        ),
        onSuccess: () => {
            toast.success(`${noticeLabel}가 수정되었습니다.`);
            queryClient.invalidateQueries({ queryKey });
            closeModal();
        },
        onError: () => {
            toast.error(`${noticeLabel} 수정에 실패했습니다.`);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => (isGlobal ? deleteGlobalNotice(id) : deleteNotice(id)),
        onSuccess: () => {
            toast.success(`${noticeLabel}가 삭제되었습니다.`);
            queryClient.invalidateQueries({ queryKey });
        },
        onError: () => {
            toast.error(`${noticeLabel} 삭제에 실패했습니다.`);
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
            title: `${noticeLabel} 삭제`,
            message: `정말로 이 ${noticeLabel}를 삭제하시겠습니까?`,
            confirmText: '삭제'
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
        setIsModalOpen(true);
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
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingNotice(null);
        reset(defaultValues);
    };

    return (
        <div className="space-y-8">
            <SettingsHeader
                title={`공지 관리 (${noticesData?.length || 0})`}
                description={
                    isGlobal
                        ? '사이트 전체에 표시되는 글로벌 공지를 관리합니다.'
                        : '블로그에 표시되는 공지를 관리합니다.'
                }
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
                <form onSubmit={handleSubmit(onSubmit)}>
                    <Modal.Body className="space-y-6">
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-gray-900">
                                공지 제목
                            </label>
                            <Input
                                placeholder="공지 제목을 입력하세요"
                                className="text-base"
                                error={errors.title?.message}
                                {...register('title')}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-gray-900">
                                URL
                            </label>
                            <Input
                                placeholder="https://example.com/notice"
                                className="text-base"
                                error={errors.url?.message}
                                {...register('url')}
                            />
                            <p className="text-xs text-gray-500">공지 클릭 시 이동할 URL입니다.</p>
                        </div>

                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                            <Checkbox
                                checked={watch('isActive')}
                                onCheckedChange={(checked) => setValue('isActive', checked)}
                                label="공지 활성화"
                                description={
                                    isGlobal
                                        ? '활성화된 공지만 사용자에게 표시됩니다.'
                                        : '활성화된 공지만 블로그에 표시됩니다.'
                                }
                            />
                        </div>
                    </Modal.Body>

                    <Modal.Footer>
                        <Modal.FooterAction
                            type="button"
                            variant="secondary"
                            onClick={closeModal}
                            disabled={createMutation.isPending || updateMutation.isPending}>
                            취소
                        </Modal.FooterAction>
                        <Modal.FooterAction
                            type="submit"
                            variant="primary"
                            isLoading={createMutation.isPending || updateMutation.isPending}>
                            {createMutation.isPending || updateMutation.isPending ? '저장 중...' : editingNotice ? '공지 수정' : '공지 생성'}
                        </Modal.FooterAction>
                    </Modal.Footer>
                </form>
            </Modal>
        </div>
    );
};

export default NoticeSettingBase;
