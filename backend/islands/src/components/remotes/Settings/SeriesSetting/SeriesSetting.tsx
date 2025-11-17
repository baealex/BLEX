import { useState, useEffect } from 'react';
import { http, type Response } from '~/modules/http.module';
import { notification } from '@baejino/ui';
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
import { useFetch } from '~/hooks/use-fetch';
import { Button } from '~/components/shared';
import { getCardClass, getIconClass, CARD_PADDING, FLEX_ROW, TITLE, SUBTITLE, ACTIONS_CONTAINER, DRAG_HANDLE } from '~/components/shared/settingsStyles';
import { useConfirm } from '~/contexts/ConfirmContext';

interface Series {
    id: number;
    url: string;
    title: string;
    totalPosts: number;
}

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
            <div className={getCardClass()}>
                <div className={CARD_PADDING}>
                    <div className={FLEX_ROW}>
                        {/* Drag handle */}
                        <div
                            className={DRAG_HANDLE}
                            style={{ touchAction: 'none' }}
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
                        <div className={ACTIONS_CONTAINER}>
                            <Button
                                variant="secondary"
                                size="md"
                                onClick={handleView}
                                title="시리즈 보기">
                                <i className="fas fa-eye" />
                            </Button>
                            <Button
                                variant="secondary"
                                size="md"
                                onClick={handleEdit}
                                title="시리즈 수정">
                                <i className="fas fa-edit" />
                            </Button>
                            <Button
                                variant="secondary"
                                size="md"
                                onClick={handleDelete}
                                title="시리즈 삭제">
                                <i className="fas fa-trash" />
                            </Button>
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

    const { data: seriesData, isLoading, isError } = useFetch({
        queryKey: ['series-setting'],
        queryFn: async () => {
            const { data } = await http<Response<{ username: string; series: Series[] }>>('v1/setting/series', { method: 'GET' });
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
            notification('시리즈 목록을 불러오는데 실패했습니다.', { type: 'error' });
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
                const orderData = newSeries.map((item, idx) => [item.id, idx]);

                const { data } = await http('v1/series/order', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify({ order: orderData })
                });

                if (data.status !== 'DONE') {
                    throw new Error('Order update failed');
                }

                notification('시리즈 순서가 변경되었습니다.', { type: 'success' });
            } catch {
                setSeries(series);
                notification('시리즈 순서 변경에 실패했습니다.', { type: 'error' });
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
            const { data } = await http(`v1/users/@${username}/series/${seriesItem.url}`, { method: 'DELETE' });

            if (data.status === 'DONE') {
                setSeries(series.filter(s => s.id !== seriesId));
                notification('시리즈가 삭제되었습니다.', { type: 'success' });
            } else {
                throw new Error('시리즈 삭제에 실패했습니다.');
            }
        } catch {
            notification('시리즈 삭제에 실패했습니다.', { type: 'error' });
        }
    };

    if (isLoading) {
        return null;
    }

    return (
        <div className="p-6 bg-white shadow-sm rounded-2xl border border-gray-200">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">시리즈 ({series.length})</h2>
                        <p className="text-gray-600">드래그하여 시리즈 순서를 조정하거나 새로운 시리즈를 만들어보세요.</p>
                    </div>
                    <Button
                        variant="primary"
                        size="md"
                        leftIcon={<i className="fas fa-plus" />}
                        onClick={handleCreateSeries}
                        className="hidden sm:inline-flex">
                        새 시리즈 만들기
                    </Button>
                </div>

                {/* Mobile button */}
                <div className="sm:hidden">
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
