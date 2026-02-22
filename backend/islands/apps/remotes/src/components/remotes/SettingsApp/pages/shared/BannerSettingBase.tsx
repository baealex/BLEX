import { useState } from 'react';
import { toast } from '~/utils/toast';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useConfirm } from '~/hooks/useConfirm';
import { SettingsEmptyState, SettingsHeader } from '../../components';
import { Button } from '~/components/shared';
import {
    getBanners,
    createBanner,
    updateBanner,
    deleteBanner,
    updateBannerOrder,
    getGlobalBanners,
    createGlobalBanner,
    updateGlobalBanner,
    deleteGlobalBanner,
    updateGlobalBannerOrder,
    type BannerData,
    type BannerCreateData,
    type BannerUpdateData,
    type GlobalBannerData,
    type GlobalBannerCreateData,
    type GlobalBannerUpdateData
} from '~/lib/api/settings';
import { BannerForm } from '../BannerSetting/components/BannerForm';
import { BannerList } from '../BannerSetting/components/BannerList';
import { GlobalBannerForm } from '../GlobalBannerSetting/components/GlobalBannerForm';
import { GlobalBannerList } from '../GlobalBannerSetting/components/GlobalBannerList';

type BannerScope = 'user' | 'global';
type BannerItem = BannerData | GlobalBannerData;
type BannerCreatePayload = BannerCreateData | GlobalBannerCreateData;
type BannerUpdatePayload = BannerUpdateData | GlobalBannerUpdateData;

interface BannerSettingBaseProps {
    scope: BannerScope;
}

const BannerSettingBase = ({ scope }: BannerSettingBaseProps) => {
    const [showForm, setShowForm] = useState(false);
    const [editingBanner, setEditingBanner] = useState<BannerItem | null>(null);
    const { confirm } = useConfirm();
    const queryClient = useQueryClient();

    const isGlobal = scope === 'global';
    const queryKey = isGlobal ? ['global-banners'] : ['banners'];
    const bannerLabel = isGlobal ? '글로벌 배너' : '배너';

    const { data: bannersData } = useSuspenseQuery({
        queryKey,
        queryFn: async () => {
            const { data } = isGlobal ? await getGlobalBanners() : await getBanners();
            if (data.status === 'DONE') {
                return data.body.banners as BannerItem[];
            }
            throw new Error('배너 목록을 불러오는데 실패했습니다.');
        }
    });

    const createMutation = useMutation({
        mutationFn: (bannerData: BannerCreatePayload) => (
            isGlobal
                ? createGlobalBanner(bannerData as GlobalBannerCreateData)
                : createBanner(bannerData as BannerCreateData)
        ),
        onSuccess: () => {
            toast.success(`${bannerLabel}가 생성되었습니다.`);
            queryClient.invalidateQueries({ queryKey });
            closeForm();
        },
        onError: () => {
            toast.error(`${bannerLabel} 생성에 실패했습니다.`);
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: BannerUpdatePayload }) => (
            isGlobal
                ? updateGlobalBanner(id, data as GlobalBannerUpdateData)
                : updateBanner(id, data as BannerUpdateData)
        ),
        onSuccess: () => {
            toast.success(`${bannerLabel}가 수정되었습니다.`);
            queryClient.invalidateQueries({ queryKey });
            closeForm();
        },
        onError: () => {
            toast.error(`${bannerLabel} 수정에 실패했습니다.`);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => (isGlobal ? deleteGlobalBanner(id) : deleteBanner(id)),
        onSuccess: () => {
            toast.success(`${bannerLabel}가 삭제되었습니다.`);
            queryClient.invalidateQueries({ queryKey });
        },
        onError: () => {
            toast.error(`${bannerLabel} 삭제에 실패했습니다.`);
        }
    });

    const orderMutation = useMutation({
        mutationFn: (order: [number, number][]) => (
            isGlobal ? updateGlobalBannerOrder(order) : updateBannerOrder(order)
        ),
        onSuccess: () => {
            toast.success(`${bannerLabel} 순서가 변경되었습니다.`);
            queryClient.invalidateQueries({ queryKey });
        },
        onError: () => {
            toast.error(`${bannerLabel} 순서 변경에 실패했습니다.`);
        }
    });

    const handleCreate = (data: BannerCreatePayload) => {
        createMutation.mutate(data);
    };

    const handleUpdate = (data: BannerUpdatePayload) => {
        if (editingBanner) {
            updateMutation.mutate({
                id: editingBanner.id,
                data
            });
        }
    };

    const handleDelete = async (id: number) => {
        const confirmed = await confirm({
            title: `${bannerLabel} 삭제`,
            message: `정말로 이 ${bannerLabel}를 삭제하시겠습니까?`,
            confirmText: '삭제'
        });

        if (confirmed) {
            deleteMutation.mutate(id);
        }
    };

    const handleEdit = (banner: BannerItem) => {
        setEditingBanner(banner);
        setShowForm(true);
    };

    const handleToggleActive = (banner: BannerItem) => {
        updateMutation.mutate({
            id: banner.id,
            data: { is_active: !banner.isActive }
        });
    };

    const handleReorder = (banners: BannerItem[]) => {
        const order: [number, number][] = banners.map((banner, index) => [banner.id, index]);
        orderMutation.mutate(order);
    };

    const handleCreateBanner = () => {
        setEditingBanner(null);
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingBanner(null);
    };

    return (
        <div className="space-y-8">
            <SettingsHeader
                title={`${isGlobal ? '글로벌 배너' : '배너'} (${bannersData?.length || 0})`}
                description={
                    isGlobal
                        ? '사이트 전체에 표시되는 글로벌 배너를 관리합니다. 드래그하여 순서를 변경할 수 있습니다.'
                        : '블로그의 상단, 하단, 사이드바에 표시될 배너를 관리합니다. 드래그하여 순서를 변경할 수 있습니다.'
                }
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

            {showForm && (
                <div className="mb-6 bg-gray-50 border border-gray-200 rounded-2xl p-6 animate-in fade-in-0 slide-in-from-top-2 motion-interaction">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">
                        {editingBanner ? `${bannerLabel} 수정` : `새 ${bannerLabel} 만들기`}
                    </h3>
                    {isGlobal ? (
                        <GlobalBannerForm
                            banner={(editingBanner as GlobalBannerData) || undefined}
                            onSubmit={(data) => (editingBanner ? handleUpdate(data) : handleCreate(data))}
                            onCancel={closeForm}
                            isLoading={createMutation.isPending || updateMutation.isPending}
                        />
                    ) : (
                        <BannerForm
                            banner={(editingBanner as BannerData) || undefined}
                            onSubmit={(data) => (editingBanner ? handleUpdate(data) : handleCreate(data))}
                            onCancel={closeForm}
                            isLoading={createMutation.isPending || updateMutation.isPending}
                        />
                    )}
                </div>
            )}

            {bannersData && bannersData.length > 0 ? (
                <div>
                    {isGlobal ? (
                        <GlobalBannerList
                            banners={bannersData as GlobalBannerData[]}
                            onEdit={(banner) => handleEdit(banner)}
                            onDelete={handleDelete}
                            onToggleActive={(banner) => handleToggleActive(banner)}
                            onReorder={(banners) => handleReorder(banners)}
                        />
                    ) : (
                        <BannerList
                            banners={bannersData as BannerData[]}
                            onEdit={(banner) => handleEdit(banner)}
                            onDelete={handleDelete}
                            onToggleActive={(banner) => handleToggleActive(banner)}
                            onReorder={(banners) => handleReorder(banners)}
                        />
                    )}
                </div>
            ) : (
                <SettingsEmptyState
                    iconClassName={isGlobal ? 'fas fa-rectangle-ad' : 'fas fa-shapes'}
                    title={isGlobal ? '등록된 글로벌 배너가 없습니다' : '등록된 배너가 없습니다'}
                    description={isGlobal ? '첫 번째 글로벌 배너를 만들어보세요.' : '첫 번째 배너를 만들어보세요.'}
                />
            )}
        </div>
    );
};

export default BannerSettingBase;
