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
import { useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { SettingsEmptyState, SettingsHeader, SettingsListItem } from '../../components';
import { Button, Dropdown } from '~/components/shared';
import {
 getIconClass,
 TITLE,
 SUBTITLE
} from '~/components/shared';
import { useConfirm } from '~/hooks/useConfirm';
import {
    getSeriesWithUsername,
    updateSeriesOrder,
    deleteSeries,
    type SeriesWithId as Series
} from '~/lib/api/settings';

interface SortableSeriesItemProps {
    series: Series;
    username: string;
    onEdit: (seriesId: number) => void;
    onDelete: (seriesId: number) => void;
}

const SortableSeriesItem = ({ series, username, onEdit, onDelete }: SortableSeriesItemProps) => {
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

    const handleView = () => {
        window.location.assign(`/@${username}/series/${series.url}`);
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
            <SettingsListItem
                onClick={handleView}
                dragHandleProps={{
                    attributes,
                    listeners
                }}
                left={
                    <div className={getIconClass('default')}>
                        <i className="fas fa-book text-sm" />
                    </div>
                }
                actions={
                    <Dropdown
                        items={[
                            {
                                label: '시리즈 편집',
                                icon: 'fas fa-pen',
                                onClick: () => onEdit(series.id)
                            },
                            {
                                label: '삭제',
                                icon: 'fas fa-trash',
                                onClick: handleDelete,
                                variant: 'danger'
                            }
                        ]}
                    />
                }>
                <h3 className={`${TITLE} mb-0.5`}>{series.title}</h3>
                <div className={SUBTITLE}>
                    <i className="fas fa-file-alt mr-1.5" />
                    {series.totalPosts}개의 포스트
                </div>
            </SettingsListItem>
        </div>
    );
};

const SeriesSetting = () => {
    const [series, setSeries] = useState<Series[]>([]);
    const [username, setUsername] = useState<string>('');
    const navigate = useNavigate();

    const { data: seriesData } = useSuspenseQuery({
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
        navigate({ to: '/series/create' });
    };

    const handleEditSeries = (seriesId: number) => {
        navigate({
            to: '/series/edit/$seriesId',
            params: { seriesId: String(seriesId) }
        });
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

    return (
        <div>
            <SettingsHeader
                title={`시리즈 (${series.length})`}
                description="드래그하여 시리즈 순서를 조정하거나 새로운 시리즈를 만들어보세요."
                actionPosition="right"
                action={
                    <Button
                        variant="primary"
                        size="md"
                        className="w-full sm:w-auto"
                        onClick={handleCreateSeries}>
                        새 시리즈 생성
                    </Button>
                }
            />

            {/* Series list */}
            {series.length >= 1 ? (
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
                                    onEdit={handleEditSeries}
                                    onDelete={handleDeleteSeries}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            ) : (
                <SettingsEmptyState
                    iconClassName="fas fa-book"
                    title="시리즈가 없습니다"
                    description="첫 번째 시리즈를 만들어보세요."
                />
            )}
        </div>
    );
};

export default SeriesSetting;
