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
import { Button } from '~/components/shared';
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
        opacity: isDragging ? 0.5 : 1
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
        <div ref={setNodeRef} style={style} className="mb-4">
            <div className="group bg-white border border-gray-200/60 rounded-2xl hover:border-gray-300 hover:shadow-lg transition-all duration-300 ease-out overflow-hidden">
                {/* Header Section */}
                <div className="p-6 border-b border-gray-100/80">
                    <div className="flex items-start justify-between gap-6">
                        {/* Drag Handle */}
                        <div
                            className="flex items-center justify-center w-10 h-10 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing transition-colors rounded-lg hover:bg-gray-100 flex-shrink-0"
                            style={{ touchAction: 'none' }}
                            {...attributes}
                            {...listeners}>
                            <i className="fas fa-grip-vertical" />
                        </div>

                        {/* Left: Content Info */}
                        <div className="flex-1 min-w-0 space-y-3">
                            {/* Title & Badges */}
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h3 className="text-lg font-semibold text-gray-900 tracking-tight">
                                    {banner.title}
                                </h3>
                                <div className="flex items-center gap-1.5">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPositionBadgeColor(banner.position)}`}>
                                        {getPositionLabel(banner.position)}
                                    </span>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-100">
                                        {getBannerTypeLabel(banner.bannerType)}
                                    </span>
                                </div>
                            </div>

                            {/* Code Preview */}
                            <div className="bg-gray-50/80 rounded-xl p-4 border border-gray-100/60">
                                <code className="text-xs font-mono text-gray-600 leading-relaxed">
                                    {banner.contentHtml.substring(0, 150)}
                                    {banner.contentHtml.length > 150 && '...'}
                                </code>
                            </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex flex-col gap-2 flex-shrink-0">
                            {/* Status Toggle */}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleActive(banner);
                                }}
                                className={`inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                                    banner.isActive
                                        ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                                        : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
                                }`}>
                                <span className={`w-2 h-2 rounded-full mr-2 ${banner.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                                {banner.isActive ? '활성' : '비활성'}
                            </button>

                            {/* Action Buttons */}
                            <div className="flex gap-2">
                                <Button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEdit(banner);
                                    }}
                                    variant="secondary"
                                    size="sm"
                                    className="flex-1"
                                    leftIcon={
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    }>
                                    수정
                                </Button>
                                <Button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(banner.id);
                                    }}
                                    variant="secondary"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    leftIcon={
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    }>
                                    삭제
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
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
