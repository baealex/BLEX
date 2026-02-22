import { useState } from 'react';
import { toast } from '~/utils/toast';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useConfirm } from '~/hooks/useConfirm';
import { SettingsEmptyState, SettingsHeader } from '../../components';
import { Button, Modal } from '~/components/shared';
import {
    getGlobalBanners,
    createGlobalBanner,
    updateGlobalBanner,
    deleteGlobalBanner,
    updateGlobalBannerOrder,
    type GlobalBannerData,
    type GlobalBannerCreateData,
    type GlobalBannerUpdateData
} from '~/lib/api/settings';
import { GlobalBannerForm, GlobalBannerList } from './components';

const GlobalBannerSetting = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBanner, setEditingBanner] = useState<GlobalBannerData | null>(null);
    const { confirm } = useConfirm();
    const queryClient = useQueryClient();

    const { data: bannersData } = useSuspenseQuery({
        queryKey: ['global-banners'],
        queryFn: async () => {
            const { data } = await getGlobalBanners();
            if (data.status === 'DONE') {
                return data.body.banners;
            }
            throw new Error('글로벌 배너 목록을 불러오는데 실패했습니다.');
        }
    });

    const createMutation = useMutation({
        mutationFn: (bannerData: GlobalBannerCreateData) => createGlobalBanner(bannerData),
        onSuccess: () => {
            toast.success('글로벌 배너가 생성되었습니다.');
            queryClient.invalidateQueries({ queryKey: ['global-banners'] });
            closeModal();
        },
        onError: () => {
            toast.error('글로벌 배너 생성에 실패했습니다.');
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: GlobalBannerUpdateData }) => updateGlobalBanner(id, data),
        onSuccess: () => {
            toast.success('글로벌 배너가 수정되었습니다.');
            queryClient.invalidateQueries({ queryKey: ['global-banners'] });
            closeModal();
        },
        onError: () => {
            toast.error('글로벌 배너 수정에 실패했습니다.');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => deleteGlobalBanner(id),
        onSuccess: () => {
            toast.success('글로벌 배너가 삭제되었습니다.');
            queryClient.invalidateQueries({ queryKey: ['global-banners'] });
        },
        onError: () => {
            toast.error('글로벌 배너 삭제에 실패했습니다.');
        }
    });

    const orderMutation = useMutation({
        mutationFn: (order: [number, number][]) => updateGlobalBannerOrder(order),
        onSuccess: () => {
            toast.success('글로벌 배너 순서가 변경되었습니다.');
            queryClient.invalidateQueries({ queryKey: ['global-banners'] });
        },
        onError: () => {
            toast.error('글로벌 배너 순서 변경에 실패했습니다.');
        }
    });

    const handleCreate = (data: GlobalBannerCreateData) => {
        createMutation.mutate(data);
    };

    const handleUpdate = (data: GlobalBannerUpdateData) => {
        if (editingBanner) {
            updateMutation.mutate({
                id: editingBanner.id,
                data
            });
        }
    };

    const handleDelete = async (id: number) => {
        const confirmed = await confirm({
            title: '글로벌 배너 삭제',
            message: '정말로 이 글로벌 배너를 삭제하시겠습니까?',
            confirmText: '삭제'
        });

        if (confirmed) {
            deleteMutation.mutate(id);
        }
    };

    const handleEdit = (banner: GlobalBannerData) => {
        setEditingBanner(banner);
        setIsModalOpen(true);
    };

    const handleToggleActive = (banner: GlobalBannerData) => {
        updateMutation.mutate({
            id: banner.id,
            data: { is_active: !banner.isActive }
        });
    };

    const handleReorder = (banners: GlobalBannerData[]) => {
        const order: [number, number][] = banners.map((banner, index) => [banner.id, index]);
        orderMutation.mutate(order);
    };

    const handleCreateBanner = () => {
        setEditingBanner(null);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingBanner(null);
    };

    return (
        <div className="space-y-8">
            <SettingsHeader
                title={`글로벌 배너 (${bannersData?.length || 0})`}
                description="사이트 전체에 표시되는 글로벌 배너를 관리합니다. 드래그하여 순서를 변경할 수 있습니다."
                actionPosition="right"
                action={
                    <Button
                        onClick={handleCreateBanner}
                        variant="primary"
                        size="md"
                        className="w-full sm:w-auto">
                        새 배너 추가
                    </Button>
                }
            />

            {bannersData && bannersData.length > 0 ? (
                <div>
                    <GlobalBannerList
                        banners={bannersData}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onToggleActive={handleToggleActive}
                        onReorder={handleReorder}
                    />
                </div>
            ) : (
                <SettingsEmptyState
                    iconClassName="fas fa-rectangle-ad"
                    title="등록된 글로벌 배너가 없습니다"
                    description="첫 번째 글로벌 배너를 만들어보세요."
                />
            )}

            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={editingBanner ? '글로벌 배너 수정' : '새 글로벌 배너 만들기'}
                maxWidth="3xl">
                <GlobalBannerForm
                    banner={editingBanner || undefined}
                    onSubmit={editingBanner ? handleUpdate : handleCreate}
                    onCancel={closeModal}
                    isLoading={createMutation.isPending || updateMutation.isPending}
                />
            </Modal>
        </div>
    );
};

export default GlobalBannerSetting;
