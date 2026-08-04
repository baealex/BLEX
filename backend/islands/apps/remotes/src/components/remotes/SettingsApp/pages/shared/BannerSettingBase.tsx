import { toast } from '~/utils/toast';
import { Trans, useLingui } from '@lingui/react/macro';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Ad, Layers3 } from '@blex/ui/icons';
import { useConfirm } from '~/hooks/useConfirm';
import {
    SettingsEmptyState,
    SettingsHeader,
    SettingsHeaderAction
} from '../../components';
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
    const { i18n, t } = useLingui();
    const { confirm } = useConfirm();
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const isGlobal = scope === 'global';
    const queryKey = isGlobal ? ['global-banners'] : ['banners'];

    const { data: bannersData } = useSuspenseQuery({
        queryKey,
        queryFn: async () => {
            const { data } = isGlobal ? await getGlobalBanners() : await getBanners();
            if (data.status === 'DONE') {
                return data.body.banners as BannerItem[];
            }
            throw new Error(t({
                id: 'settings.banners.load_failed',
                message: 'Could not load banners.'
            }));
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
            toast.error(i18n._({
                id: 'settings.banners.update.failed',
                message: '{scope, select, global {Could not update the global banner.} other {Could not update the banner.}}',
                values: { scope }
            }));
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => (isGlobal ? deleteGlobalBanner(id) : deleteBanner(id)),
        onSuccess: () => {
            toast.success(i18n._({
                id: 'settings.banners.delete.success',
                message: '{scope, select, global {Global banner deleted.} other {Banner deleted.}}',
                values: { scope }
            }));
            queryClient.invalidateQueries({ queryKey });
        },
        onError: () => {
            toast.error(i18n._({
                id: 'settings.banners.delete.failed',
                message: '{scope, select, global {Could not delete the global banner.} other {Could not delete the banner.}}',
                values: { scope }
            }));
        }
    });

    const orderMutation = useMutation({
        mutationFn: (order: [number, number][]) => (
            isGlobal ? updateGlobalBannerOrder(order) : updateBannerOrder(order)
        ),
        onSuccess: () => {
            toast.success(i18n._({
                id: 'settings.banners.order.success',
                message: '{scope, select, global {Global banner order updated.} other {Banner order updated.}}',
                values: { scope }
            }));
            queryClient.invalidateQueries({ queryKey });
        },
        onError: () => {
            toast.error(i18n._({
                id: 'settings.banners.order.failed',
                message: '{scope, select, global {Could not update global banner order.} other {Could not update banner order.}}',
                values: { scope }
            }));
        }
    });

    const handleDelete = async (id: number) => {
        const confirmed = await confirm({
            title: i18n._({
                id: 'settings.banners.delete.title',
                message: '{scope, select, global {Delete global banner} other {Delete banner}}',
                values: { scope }
            }),
            message: i18n._({
                id: 'settings.banners.delete.confirm',
                message: '{scope, select, global {Delete this global banner?} other {Delete this banner?}}',
                values: { scope }
            }),
            confirmText: t({
                id: 'common.delete',
                message: 'Delete'
            })
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
        <SettingsHeaderAction
            onClick={handleCreateBanner}
            variant="primary">
            <Trans id="settings.banners.create_action">Add banner</Trans>
        </SettingsHeaderAction>
    );

    return (
        <div className="space-y-8">
            <SettingsHeader
                title={i18n._({
                    id: 'settings.banners.title_count',
                    message: '{scope, select, global {Global banners ({count})} other {Banners ({count})}}',
                    values: {
                        scope,
                        count: bannersData?.length || 0
                    }
                })}
                description={
                    isGlobal
                        ? t({
                            id: 'settings.banners.description.global',
                            message: 'Active banners are shown across the entire site. Drag the list to change their display order.'
                        })
                        : t({
                            id: 'settings.banners.description.user',
                            message: 'Banners appear at the top, bottom, or in a sidebar. Drag the list to change their order.'
                        })
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
                    title={isGlobal
                        ? t({
                            id: 'settings.banners.empty.global',
                            message: 'No global banners yet'
                        })
                        : t({
                            id: 'settings.banners.empty.user',
                            message: 'No banners yet'
                        })}
                    action={createAction}
                />
            )}
        </div>
    );
};

export default BannerSettingBase;
