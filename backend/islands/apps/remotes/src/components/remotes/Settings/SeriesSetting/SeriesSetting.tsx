import { useState, useEffect } from 'react';
import { toast } from '~/utils/toast';
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
import { useQuery } from '@tanstack/react-query';
import { Button, Dropdown } from '~/components/shared';
import {
 getCardClass,
 getIconClass,
 CARD_PADDING,
 FLEX_ROW,
 TITLE,
 SUBTITLE,
 ACTIONS_CONTAINER,
 DRAG_HANDLE
} from '~/components/shared';
import { useConfirm } from '~/contexts/ConfirmContext';
import {
    getSeriesWithUsername,
    updateSeriesOrder,
    deleteSeries,
    type SeriesWithId as Series
} from '~/lib/api/settings';

interface SortableSeriesItemProps {
    series: Series;
    username: string;
    onDelete: (seriesId: number) => void;
}

const SortableSeriesItem = ({ series, username, onDelete }: SortableSeriesItemProps) => {
    const { confirm } = useConfirm();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: series.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1
    };

    const handleEdit = () => {
        window.location.href = `/@${username}/series/${series.url}/edit`;
    };

    const handleView = () => {
        window.location.href = `/@${username}/series/${series.url}`;
    };

    const handleDelete = async () => {
        const confirmed = await confirm({
            title: '시리즈 삭제',
            message: `"${series.title}" 시리즈를 정말 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`,
            confirmText: '삭제',
            variant: 'danger'
        });

        if (confirmed) {
            onDelete(series.id);
        }
    };

    return (
        <div ref={setNodeRef} style={style} className="mb-3">
            <div className={getCardClass('cursor-pointer')} onClick={handleEdit}>
                <div className={CARD_PADDING}>
                    <div className={FLEX_ROW}>
                        {/* Drag handle */}
                        <div
                            className={DRAG_HANDLE}
                            style={{ touchAction: 'none' }}
                            onClick={(e) => e.stopPropagation()}
                            {...attributes}
                            {...listeners}>
                            <i className="fas fa-grip-vertical" />
                        </div>

                        {/* Icon */}
                        <div className={getIconClass('dark')}>
                            <i className="fas fa-book text-sm" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <h3 className={`${TITLE} mb-0.5`}>{series.title}</h3>
                            <div className={SUBTITLE}>
                                <i className="fas fa-file-alt mr-1.5" />
                                {series.totalPosts}개의 포스트
                            </div>
                        </div>

                        {/* Actions */}
                        <div className={ACTIONS_CONTAINER} onClick={(e) => e.stopPropagation()}>
                            <Dropdown
                                items={[
                                    {
                                        label: '시리즈 보기',
                                        icon: 'fas fa-eye',
                                        onClick: handleView
                                    },
                                    {
                                        label: '삭제',
                                        icon: 'fas fa-trash',
                                        onClick: handleDelete,
                                        variant: 'danger'
                                    }
                                ]}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SeriesSetting = () => {
    const [series, setSeries] = useState<Series[]>([]);
    const [username, setUsername] = useState<string>('');

    const { data: seriesData, isLoading, isError } = useQuery({
        queryKey: ['series-setting'],
        queryFn: async () => {
            const { data } = await getSeriesWithUsername();
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error('시리즈 목록을 불러오는데 실패했습니다.');
        }
    });

    useEffect(() => {
        if (seriesData) {
            setSeries(seriesData.series);
            setUsername(seriesData.username);
        }
    }, [seriesData]);

    useEffect(() => {
        if (isError) {
            toast.error('시리즈 목록을 불러오는데 실패했습니다.');
        }
    }, [isError]);

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

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = series.findIndex((item) => item.id === active.id);
            const newIndex = series.findIndex((item) => item.id === over.id);

            const newSeries = arrayMove(series, oldIndex, newIndex);
            setSeries(newSeries);

            try {
                const orderData: [number, number][] = newSeries.map((item, idx) => [item.id, idx]);

                const { data } = await updateSeriesOrder(orderData);

                if (data.status !== 'DONE') {
                    throw new Error('Order update failed');
                }

                toast.success('시리즈 순서가 변경되었습니다.');
            } catch {
                setSeries(series);
                toast.error('시리즈 순서 변경에 실패했습니다.');
            }
        }
    };

    const handleCreateSeries = () => {
        window.location.href = `/@${username}/series/create`;
    };

    const handleDeleteSeries = async (seriesId: number) => {
        const seriesItem = series.find(s => s.id === seriesId);
        if (!seriesItem) return;

        try {
            const { data } = await deleteSeries(username, seriesItem.url);

            if (data.status === 'DONE') {
                setSeries(series.filter(s => s.id !== seriesId));
                toast.success('시리즈가 삭제되었습니다.');
            } else {
                throw new Error('시리즈 삭제에 실패했습니다.');
            }
        } catch {
            toast.error('시리즈 삭제에 실패했습니다.');
        }
    };

    if (isLoading) {
        return null;
    }

    return (
        <div>
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">시리즈 ({series.length})</h2>
                        <p className="text-gray-600">드래그하여 시리즈 순서를 조정하거나 새로운 시리즈를 만들어보세요.</p>
                    </div>
                </div>

                <div>
                    <Button
                        variant="primary"
                        size="md"
                        fullWidth
                        leftIcon={<i className="fas fa-plus" />}
                        onClick={handleCreateSeries}>
                        새 시리즈 만들기
                    </Button>
                </div>
            </div>

            {/* Series list */}
            {series.length === 0 ? (
                <div className="text-center py-16">
                    <div className="w-20 h-20 mx-auto bg-gray-100 rounded-2xl flex items-center justify-center mb-6">
                        <i className="fas fa-book text-gray-400 text-3xl" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">시리즈가 없습니다</h3>
                    <p className="text-gray-500 mb-6">첫 번째 시리즈를 만들어보세요!</p>
                    <Button
                        variant="primary"
                        size="md"
                        leftIcon={<i className="fas fa-plus" />}
                        onClick={handleCreateSeries}>
                        첫 시리즈 만들기
                    </Button>
                </div>
            ) : (
                <DndContext
                    sensors={sensors}
                    modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}>
                    <SortableContext
                        items={series.map(item => item.id)}
                        strategy={verticalListSortingStrategy}>
                        <div>
                            {series.map((item) => (
                                <SortableSeriesItem
                                    key={item.id}
                                    series={item}
                                    username={username}
                                    onDelete={handleDeleteSeries}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}
        </div>
    );
};

export default SeriesSetting;
