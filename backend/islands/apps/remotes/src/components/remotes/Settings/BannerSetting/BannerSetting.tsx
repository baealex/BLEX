import { useState } from 'react';
import { toast } from '~/utils/toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useConfirm } from '~/contexts/ConfirmContext';
import { SettingsHeader } from '../components';
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

    const { data: bannersData, isLoading } = useQuery({
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
        <div>
            <SettingsHeader
                title={`배너 (${bannersData?.length || 0})`}
                description="드래그하여 배너 순서를 조정하거나 새로운 배너를 만들어보세요."
                action={
                    <Button
                        onClick={handleCreateBanner}
                        variant="primary"
                        size="md"
                        fullWidth
                        leftIcon={<i className="fas fa-plus" />}>
                        새 배너 추가
                    </Button>
                }
            />

            {isLoading ? (
                <div className="py-12 text-center">
                    <p className="text-gray-500">로딩 중...</p>
                </div>
            ) : bannersData && bannersData.length > 0 ? (
                <BannerList
                    banners={bannersData}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggleActive={handleToggleActive}
                    onReorder={handleReorder}
                />
            ) : (
                <div className="py-12 text-center bg-white border border-gray-200 rounded-2xl">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gray-50 mb-3">
                        <svg className="w-6 h-6 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <p className="text-gray-400 font-medium">아직 배너가 없습니다</p>
                    <p className="text-gray-400 text-sm mt-1">새 배너를 추가하여 블로그를 꾸며보세요</p>
                </div>
            )}

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex">
                    <svg className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div className="text-sm text-blue-800">
                        <p className="font-medium mb-2">배너 사용 팁:</p>
                        <ul className="list-disc list-inside space-y-1 text-xs">
                            <li><strong>줄배너</strong>: 상단/하단에 표시되는 가로 전체 배너 (공지사항, 이벤트 등)</li>
                            <li><strong>사이드배너</strong>: 좌/우측에 표시되는 측면 배너 (광고, 링크 모음 등)</li>
                            <li>HTML을 사용할 수 있지만 스크립트는 보안상 자동 제거됩니다</li>
                            <li>드래그앤드롭으로 배너 순서를 변경할 수 있습니다</li>
                        </ul>
                    </div>
                </div>
            </div>

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
