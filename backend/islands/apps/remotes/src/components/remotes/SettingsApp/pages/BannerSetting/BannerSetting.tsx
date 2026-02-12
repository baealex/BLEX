import { useState } from 'react';
import { toast } from '~/utils/toast';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useConfirm } from '~/hooks/useConfirm';
import { SettingsHeader } from '../../components';
import { Button, Modal } from '~/components/shared';
import {
    getBanners,
    createBanner,
    updateBanner,
    deleteBanner,
    updateBannerOrder,
    type BannerData,
    type BannerCreateData,
    type BannerUpdateData
} from '~/lib/api/settings';
import { BannerForm } from './components/BannerForm';
import { BannerList } from './components/BannerList';

const BannerSetting = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBanner, setEditingBanner] = useState<BannerData | null>(null);
    const { confirm } = useConfirm();
    const queryClient = useQueryClient();

    const { data: bannersData } = useSuspenseQuery({
        queryKey: ['banners'],
        queryFn: async () => {
            const { data } = await getBanners();
            if (data.status === 'DONE') {
                return data.body.banners;
            }
            throw new Error('배너 목록을 불러오는데 실패했습니다.');
        }
    });

    const createMutation = useMutation({
        mutationFn: (bannerData: BannerCreateData) => createBanner(bannerData),
        onSuccess: () => {
            toast.success('배너가 생성되었습니다.');
            queryClient.invalidateQueries({ queryKey: ['banners'] });
            closeModal();
        },
        onError: () => {
            toast.error('배너 생성에 실패했습니다.');
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: BannerUpdateData }) => updateBanner(id, data),
        onSuccess: () => {
            toast.success('배너가 수정되었습니다.');
            queryClient.invalidateQueries({ queryKey: ['banners'] });
            closeModal();
        },
        onError: () => {
            toast.error('배너 수정에 실패했습니다.');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => deleteBanner(id),
        onSuccess: () => {
            toast.success('배너가 삭제되었습니다.');
            queryClient.invalidateQueries({ queryKey: ['banners'] });
        },
        onError: () => {
            toast.error('배너 삭제에 실패했습니다.');
        }
    });

    const orderMutation = useMutation({
        mutationFn: (order: [number, number][]) => updateBannerOrder(order),
        onSuccess: () => {
            toast.success('배너 순서가 변경되었습니다.');
            queryClient.invalidateQueries({ queryKey: ['banners'] });
        },
        onError: () => {
            toast.error('배너 순서 변경에 실패했습니다.');
        }
    });

    const handleCreate = (data: BannerCreateData) => {
        createMutation.mutate(data);
    };

    const handleUpdate = (data: BannerUpdateData) => {
        if (editingBanner) {
            updateMutation.mutate({
 id: editingBanner.id,
data
});
        }
    };

    const handleDelete = async (id: number) => {
        const confirmed = await confirm({
            title: '배너 삭제',
            message: '정말로 이 배너를 삭제하시겠습니까?',
            confirmText: '삭제'
        });

        if (confirmed) {
            deleteMutation.mutate(id);
        }
    };

    const handleEdit = (banner: BannerData) => {
        setEditingBanner(banner);
        setIsModalOpen(true);
    };

    const handleToggleActive = (banner: BannerData) => {
        updateMutation.mutate({
            id: banner.id,
            data: { is_active: !banner.isActive }
        });
    };

    const handleReorder = (banners: BannerData[]) => {
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
                title={`배너 (${bannersData?.length || 0})`}
                description="블로그의 상단, 하단, 사이드바에 표시될 배너를 관리합니다. 드래그하여 순서를 변경할 수 있습니다."
                action={
                    <Button
                        onClick={handleCreateBanner}
                        variant="primary"
                        size="md"
                        className="shadow-sm"
                        leftIcon={<i className="fas fa-plus" />}>
                        새 배너 추가
                    </Button>
                }
            />

            {/* Banner List */}
            {bannersData && bannersData.length > 0 ? (
                <div>
                    <BannerList
                        banners={bannersData}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onToggleActive={handleToggleActive}
                        onReorder={handleReorder}
                    />
                </div>
            ) : (
                <div className="py-16 text-center border border-dashed border-gray-200 rounded-2xl">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-50 mb-4">
                        <i className="fas fa-shapes text-2xl text-gray-300" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">등록된 배너가 없습니다</h3>
                    <p className="text-gray-500 text-sm mb-6">첫 번째 배너를 만들어보세요.</p>
                    <Button variant="secondary" size="md" onClick={handleCreateBanner}>
                        배너 생성하기
                    </Button>
                </div>
            )}

            {/* Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={editingBanner ? '배너 수정' : '새 배너 만들기'}
                maxWidth="3xl">
                <BannerForm
                    banner={editingBanner || undefined}
                    onSubmit={editingBanner ? handleUpdate : handleCreate}
                    onCancel={closeModal}
                    isLoading={createMutation.isPending || updateMutation.isPending}
                />
            </Modal>
        </div>
    );
};

export default BannerSetting;
