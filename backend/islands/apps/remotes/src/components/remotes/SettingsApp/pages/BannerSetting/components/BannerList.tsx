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
import type { BannerData } from '~/lib/api/settings';

interface BannerListProps {
    banners: BannerData[];
    onEdit: (banner: BannerData) => void;
    onDelete: (id: number) => void;
    onToggleActive: (banner: BannerData) => void;
    onReorder: (banners: BannerData[]) => void;
}

interface SortableBannerItemProps {
    banner: BannerData;
    onEdit: (banner: BannerData) => void;
    onDelete: (id: number) => void;
    onToggleActive: (banner: BannerData) => void;
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

    const getPositionBadgeColor = (position: string) => {
        const colors: Record<string, string> = {
            top: 'bg-blue-50 text-blue-700 border-blue-100',
            bottom: 'bg-emerald-50 text-emerald-700 border-emerald-100',
            left: 'bg-purple-50 text-purple-700 border-purple-100',
            right: 'bg-pink-50 text-pink-700 border-pink-100'
        };
        return colors[position] || 'bg-gray-50 text-gray-700 border-gray-100';
    };

    return (
        <div ref={setNodeRef} style={style} className="mb-3">
            <SettingsListItem
                onClick={() => onEdit(banner)}
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
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className={`${TITLE} mb-0`}>
                                {banner.title}
                            </h3>
                            {/* Mobile Status Badge */}
                            <span className={`sm:hidden inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${banner.isActive ? 'bg-green-50 text-green-700 border-green-100' : 'bg-gray-50 text-gray-500 border-gray-100'}`}>
                                {banner.isActive ? 'ON' : 'OFF'}
                            </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap text-sm">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getPositionBadgeColor(banner.position)}`}>
                                {getPositionLabel(banner.position)}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-600 border border-gray-100">
                                {getBannerTypeLabel(banner.bannerType)}
                            </span>
                            <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${banner.isActive ? 'bg-green-50 text-green-700 border-green-100' : 'bg-gray-50 text-gray-500 border-gray-100'}`}>
                                {banner.isActive ? '활성' : '비활성'}
                            </span>
                        </div>
                    </div>

                    {/* Code Preview */}
                    <div className="relative bg-gray-50 rounded-lg border border-gray-100 p-3 font-mono text-xs text-gray-600 overflow-hidden max-w-2xl">
                        <div className="absolute top-0 bottom-0 left-0 w-1 bg-gray-200" />
                        <p className="line-clamp-2 pl-2 break-all">
                            {banner.contentHtml}
                        </p>
                    </div>
                </div>
            </SettingsListItem>
        </div>
    );
};

export const BannerList = ({
    banners,
    onEdit,
    onDelete,
    onToggleActive,
    onReorder
}: BannerListProps) => {
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
