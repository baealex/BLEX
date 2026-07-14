import { toast } from '~/utils/toast';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Ad, Layers3 } from '@blex/ui/icons';
import { useConfirm } from '~/hooks/useConfirm';
import { SettingsEmptyState, SettingsHeader } from '../../components';
import { Button } from '~/components/shared';
import {
    getBanners,
    updateBanner,
    deleteBanner,
    updateBannerOrder,
    getGlobalBanners,
    updateGlobalBanner,
    deleteGlobalBanner,
    updateGlobalBannerOrder,
    type BannerData,
    type BannerUpdateData,
    type GlobalBannerData,
    type GlobalBannerUpdateData
} from '~/lib/api/settings';
import { BannerList } from '../BannerSetting/components/BannerList';
import { GlobalBannerList } from '../GlobalBannerSetting/components/GlobalBannerList';

type BannerScope = 'user' | 'global';
type BannerItem = BannerData | GlobalBannerData;
type BannerUpdatePayload = BannerUpdateData | GlobalBannerUpdateData;

interface BannerSettingBaseProps {
    scope: BannerScope;
}

const BannerSettingBase = ({ scope }: BannerSettingBaseProps) => {
    const { confirm } = useConfirm();
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const isGlobal = scope === 'global';
    const queryKey = isGlobal ? ['global-banners'] : ['banners'];
    const bannerLabel = isGlobal ? '전역 배너' : '배너';

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

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: BannerUpdatePayload }) => (
            isGlobal
                ? updateGlobalBanner(id, data as GlobalBannerUpdateData)
                : updateBanner(id, data as BannerUpdateData)
        ),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
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

    const handleEdit = (bannerId: number) => {
        if (isGlobal) {
            navigate({
                to: '/global-banners/edit/$bannerId',
                params: { bannerId: String(bannerId) }
            });
            return;
        }

        navigate({
            to: '/banners/edit/$bannerId',
            params: { bannerId: String(bannerId) }
        });
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
        if (isGlobal) {
            navigate({ to: '/global-banners/create' });
            return;
        }

        navigate({ to: '/banners/create' });
    };

    const createAction = (
        <Button
            onClick={handleCreateBanner}
            variant="primary"
            size="md"
            className="min-h-11! w-full sm:w-auto">
            새 배너 추가
        </Button>
    );

    return (
        <div className="space-y-8">
            <SettingsHeader
                title={`${bannerLabel} (${bannersData?.length || 0})`}
                description={
                    isGlobal
                        ? '활성 배너는 사이트 전체에 표시되며, 목록을 드래그해 노출 순서를 바꿀 수 있습니다.'
                        : '상단·하단·사이드바에 표시되며 드래그하여 순서를 조정할 수 있습니다.'
                }
                actionPosition="right"
                action={bannersData && bannersData.length > 0 ? createAction : undefined}
            />

            {bannersData && bannersData.length > 0 ? (
                <div>
                    {isGlobal ? (
                        <GlobalBannerList
                            banners={bannersData as GlobalBannerData[]}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            onToggleActive={(banner) => handleToggleActive(banner)}
                            onReorder={(banners) => handleReorder(banners)}
                        />
                    ) : (
                        <BannerList
                            banners={bannersData as BannerData[]}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            onToggleActive={(banner) => handleToggleActive(banner)}
                            onReorder={(banners) => handleReorder(banners)}
                        />
                    )}
                </div>
            ) : (
                <SettingsEmptyState
                    icon={isGlobal
                        ? <Ad aria-hidden="true" className="h-4 w-4" />
                        : <Layers3 aria-hidden="true" className="h-4 w-4" />}
                    title={isGlobal ? '전역 배너가 없습니다' : '등록된 배너가 없습니다'}
                    action={createAction}
                />
            )}
        </div>
    );
};

export default BannerSettingBase;
