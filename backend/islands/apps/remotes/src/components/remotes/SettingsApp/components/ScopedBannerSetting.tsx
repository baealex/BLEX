import { useState } from 'react';
import type { ComponentType } from 'react';
import type { AxiosResponse } from 'axios';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { toast } from '~/utils/toast';
import { useConfirm } from '~/hooks/useConfirm';
import { Button, Modal } from '~/components/shared';
import type { Response } from '~/lib/http.module';
import { SettingsEmptyState, SettingsHeader } from '.';

interface BannerLike {
    id: number;
    isActive: boolean;
}

interface BannerListProps<TBanner extends BannerLike> {
    banners: TBanner[];
    onEdit: (banner: TBanner) => void;
    onDelete: (id: number) => void;
    onToggleActive: (banner: TBanner) => void;
    onReorder: (banners: TBanner[]) => void;
}

interface BannerFormProps<TBanner extends BannerLike, TCreateData> {
    banner?: TBanner;
    onSubmit: (data: TCreateData) => void;
    onCancel: () => void;
    isLoading: boolean;
}

interface ScopedBannerSettingProps<
    TBanner extends BannerLike,
    TCreateData,
    TUpdateData
> {
    queryKey: string[];
    title: string;
    description: string;
    emptyIconClassName: string;
    emptyTitle: string;
    emptyDescription: string;
    modalCreateTitle: string;
    modalEditTitle: string;
    createButtonLabel?: string;
    deleteConfirmTitle: string;
    deleteConfirmMessage: string;
    createSuccessMessage: string;
    createErrorMessage: string;
    updateSuccessMessage: string;
    updateErrorMessage: string;
    deleteSuccessMessage: string;
    deleteErrorMessage: string;
    reorderSuccessMessage: string;
    reorderErrorMessage: string;
    fetchBanners: () => Promise<AxiosResponse<Response<{ banners: TBanner[] }>>>;
    createBanner: (data: TCreateData) => Promise<AxiosResponse<Response<unknown>>>;
    updateBanner: (id: number, data: TUpdateData) => Promise<AxiosResponse<Response<unknown>>>;
    deleteBanner: (id: number) => Promise<AxiosResponse<Response<unknown>>>;
    reorderBanners: (order: [number, number][]) => Promise<AxiosResponse<Response<unknown>>>;
    toTogglePayload: (banner: TBanner) => TUpdateData;
    toUpdatePayload: (data: TCreateData) => TUpdateData;
    FormComponent: ComponentType<BannerFormProps<TBanner, TCreateData>>;
    ListComponent: ComponentType<BannerListProps<TBanner>>;
}

const ScopedBannerSetting = <
    TBanner extends BannerLike,
    TCreateData,
    TUpdateData
>({
    queryKey,
    title,
    description,
    emptyIconClassName,
    emptyTitle,
    emptyDescription,
    modalCreateTitle,
    modalEditTitle,
    createButtonLabel = '새 배너 추가',
    deleteConfirmTitle,
    deleteConfirmMessage,
    createSuccessMessage,
    createErrorMessage,
    updateSuccessMessage,
    updateErrorMessage,
    deleteSuccessMessage,
    deleteErrorMessage,
    reorderSuccessMessage,
    reorderErrorMessage,
    fetchBanners,
    createBanner,
    updateBanner,
    deleteBanner,
    reorderBanners,
    toTogglePayload,
    toUpdatePayload,
    FormComponent,
    ListComponent
}: ScopedBannerSettingProps<TBanner, TCreateData, TUpdateData>) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBanner, setEditingBanner] = useState<TBanner | null>(null);
    const { confirm } = useConfirm();
    const queryClient = useQueryClient();

    const { data: bannersData } = useSuspenseQuery({
        queryKey,
        queryFn: async () => {
            const { data } = await fetchBanners();
            if (data.status === 'DONE') {
                return data.body.banners;
            }
            throw new Error('배너 목록을 불러오는데 실패했습니다.');
        }
    });

    const createMutation = useMutation({
        mutationFn: (bannerData: TCreateData) => createBanner(bannerData),
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
        mutationFn: ({ id, data }: { id: number; data: TUpdateData }) => updateBanner(id, data),
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
        mutationFn: (id: number) => deleteBanner(id),
        onSuccess: () => {
            toast.success(deleteSuccessMessage);
            queryClient.invalidateQueries({ queryKey });
        },
        onError: () => {
            toast.error(deleteErrorMessage);
        }
    });

    const orderMutation = useMutation({
        mutationFn: (order: [number, number][]) => reorderBanners(order),
        onSuccess: () => {
            toast.success(reorderSuccessMessage);
            queryClient.invalidateQueries({ queryKey });
        },
        onError: () => {
            toast.error(reorderErrorMessage);
        }
    });

    const handleCreate = (data: TCreateData) => {
        createMutation.mutate(data);
    };

    const handleUpdate = (data: TCreateData) => {
        if (editingBanner) {
            updateMutation.mutate({
                id: editingBanner.id,
                data: toUpdatePayload(data)
            });
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

    const handleEdit = (banner: TBanner) => {
        setEditingBanner(banner);
        setIsModalOpen(true);
    };

    const handleToggleActive = (banner: TBanner) => {
        updateMutation.mutate({
            id: banner.id,
            data: toTogglePayload(banner)
        });
    };

    const handleReorder = (banners: TBanner[]) => {
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
                title={`${title} (${bannersData?.length || 0})`}
                description={description}
                actionPosition="right"
                action={
                    <Button
                        onClick={handleCreateBanner}
                        variant="primary"
                        size="md"
                        className="w-full sm:w-auto">
                        {createButtonLabel}
                    </Button>
                }
            />

            {bannersData && bannersData.length > 0 ? (
                <div>
                    <ListComponent
                        banners={bannersData}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onToggleActive={handleToggleActive}
                        onReorder={handleReorder}
                    />
                </div>
            ) : (
                <SettingsEmptyState
                    iconClassName={emptyIconClassName}
                    title={emptyTitle}
                    description={emptyDescription}
                />
            )}

            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={editingBanner ? modalEditTitle : modalCreateTitle}
                maxWidth="3xl">
                <FormComponent
                    banner={editingBanner || undefined}
                    onSubmit={editingBanner ? handleUpdate : handleCreate}
                    onCancel={closeModal}
                    isLoading={createMutation.isPending || updateMutation.isPending}
                />
            </Modal>
        </div>
    );
};

export default ScopedBannerSetting;
