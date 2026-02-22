import type { DragEndEvent } from '@dnd-kit/core';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    TouchSensor
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
    arrayMove,
    sortableKeyboardCoordinates
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis, restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';

import {
    TITLE,
    Dropdown
} from '~/components/shared';
import { SettingsListItem } from '../../../components';
import type { GlobalBannerData } from '~/lib/api/settings';

interface GlobalBannerListProps {
    banners: GlobalBannerData[];
    onEdit: (banner: GlobalBannerData) => void;
    onDelete: (id: number) => void;
    onToggleActive: (banner: GlobalBannerData) => void;
    onReorder: (banners: GlobalBannerData[]) => void;
}

interface SortableBannerItemProps {
    banner: GlobalBannerData;
    onEdit: (banner: GlobalBannerData) => void;
    onDelete: (id: number) => void;
    onToggleActive: (banner: GlobalBannerData) => void;
}

const SortableBannerItem = ({ banner, onEdit, onDelete, onToggleActive }: SortableBannerItemProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: banner.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: 'relative' as const,
        zIndex: isDragging ? 999 : 1
    };

    const getBannerTypeLabel = (type: string) => {
        return type === 'horizontal' ? '줄배너' : '사이드배너';
    };

    const getPositionLabel = (position: string) => {
        const labels: Record<string, string> = {
            top: '상단',
            bottom: '하단',
            left: '좌측',
            right: '우측'
        };
        return labels[position] || position;
    };

    return (
        <div ref={setNodeRef} style={style} className="mb-3">
            <SettingsListItem
                dragHandleProps={{
                    attributes,
                    listeners
                }}
                actions={
                    <Dropdown
                        items={[
                            {
                                label: banner.isActive ? '비활성화' : '활성화',
                                icon: 'fas fa-power-off',
                                onClick: () => onToggleActive(banner)
                            },
                            {
                                label: '수정',
                                icon: 'fas fa-pen',
                                onClick: () => onEdit(banner)
                            },
                            {
                                label: '삭제',
                                icon: 'fas fa-trash',
                                onClick: () => onDelete(banner.id),
                                variant: 'danger'
                            }
                        ]}
                    />
                }>
                <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`${TITLE} mb-0`}>
                            {banner.title}
                        </h3>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                            {getPositionLabel(banner.position)}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                            {getBannerTypeLabel(banner.bannerType)}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${banner.isActive ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-50 text-gray-500 border-gray-100'}`}>
                            {banner.isActive ? '활성' : '비활성'}
                        </span>
                        {banner.createdBy && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                                {banner.createdBy}
                            </span>
                        )}
                    </div>

                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 break-all">
                        {banner.contentHtml}
                    </p>
                </div>
            </SettingsListItem>
        </div>
    );
};

export const GlobalBannerList = ({
    banners,
    onEdit,
    onDelete,
    onToggleActive,
    onReorder
}: GlobalBannerListProps) => {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 200,
                tolerance: 5
            }
        }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = banners.findIndex((item) => item.id === active.id);
            const newIndex = banners.findIndex((item) => item.id === over.id);

            const newBanners = arrayMove(banners, oldIndex, newIndex);
            onReorder(newBanners);
        }
    };

    return (
        <DndContext
            sensors={sensors}
            modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}>
            <SortableContext
                items={banners.map(item => item.id)}
                strategy={verticalListSortingStrategy}>
                <div>
                    {banners.map((banner) => (
                        <SortableBannerItem
                            key={banner.id}
                            banner={banner}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onToggleActive={onToggleActive}
                        />
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    );
};
