import { useState, useEffect } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
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
import { BookOpen, FileText, Pencil, Trash2 } from '@blex/ui/icons';
import {
    SettingsEmptyState,
    SettingsHeader,
    SettingsHeaderAction,
    SettingsListItem
} from '../../components';
import { Dropdown } from '~/components/shared';
import {
    getSettingsIconClass,
    SETTINGS_LIST_META,
    SETTINGS_LIST_TITLE
} from '~/styles/settingsStyles';
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
    const { i18n, t } = useLingui();
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
            title: t({
                id: 'settings.series.delete.title',
                message: 'Delete series'
            }),
            message: i18n._({
                id: 'settings.series.delete.list_confirm',
                message: 'Delete the series "{title}"?\n\nThis action cannot be undone.',
                values: { title: series.title }
            }),
            confirmText: t({
                id: 'common.delete',
                message: 'Delete'
            }),
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
                    listeners,
                    ariaLabel: i18n._({
                        id: 'settings.series.item.reorder',
                        message: 'Change order of series: {title}',
                        values: { title: series.title }
                    })
                }}
                left={
                    <div className={getSettingsIconClass('default')}>
                        <BookOpen aria-hidden className="h-4 w-4" />
                    </div>
                }
                actions={
                    <Dropdown
                        density="compact"
                        triggerAriaLabel={i18n._({
                            id: 'settings.series.item.open_menu',
                            message: 'Open menu for series: {title}',
                            values: { title: series.title }
                        })}
                        triggerClassName="min-h-11 min-w-11 [@media(pointer:fine)]:min-h-9 [@media(pointer:fine)]:min-w-9"
                        items={[
                            {
                                label: t({
                                    id: 'settings.series.item.edit',
                                    message: 'Edit series'
                                }),
                                icon: <Pencil aria-hidden className="h-4 w-4" />,
                                onClick: () => onEdit(series.id)
                            },
                            {
                                label: t({
                                    id: 'common.delete',
                                    message: 'Delete'
                                }),
                                icon: <Trash2 aria-hidden className="h-4 w-4" />,
                                onClick: handleDelete,
                                variant: 'danger'
                            }
                        ]}
                    />
                }>
                <h3 className={`${SETTINGS_LIST_TITLE} mb-0.5`}>{series.title}</h3>
                <div className={SETTINGS_LIST_META}>
                    <FileText aria-hidden className="mr-1.5 inline h-3.5 w-3.5" />
                    {i18n._({
                        id: 'settings.series.item.post_count',
                        message: '{count, plural, one {# post} other {# posts}}',
                        values: { count: series.totalPosts }
                    })}
                </div>
            </SettingsListItem>
        </div>
    );
};

const SeriesSetting = () => {
    const { i18n, t } = useLingui();
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
            throw new Error(t({
                id: 'settings.series.load_failed',
                message: 'Could not load series.'
            }));
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
                    toast.error(data.errorMessage || t({
                        id: 'settings.series.order.update_failed',
                        message: 'Could not update the series order.'
                    }));
                    setSeries(series);
                    return;
                }

                toast.success(t({
                    id: 'settings.series.order.update_success',
                    message: 'Series order updated.'
                }));
            } catch {
                setSeries(series);
                toast.error(t({
                    id: 'settings.series.order.update_failed',
                    message: 'Could not update the series order.'
                }));
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
                toast.success(t({
                    id: 'settings.series.delete.success',
                    message: 'Series deleted.'
                }));
            } else {
                toast.error(data.errorMessage || t({
                    id: 'settings.series.delete.failed',
                    message: 'Could not delete the series.'
                }));
            }
        } catch {
            toast.error(t({
                id: 'settings.series.delete.failed',
                message: 'Could not delete the series.'
            }));
        }
    };

    const createAction = (
        <SettingsHeaderAction
            variant="primary"
            onClick={handleCreateSeries}>
            <Trans id="settings.series.create_new">Create series</Trans>
        </SettingsHeaderAction>
    );

    return (
        <div>
            <SettingsHeader
                title={i18n._({
                    id: 'settings.series.title_count',
                    message: 'Series ({count})',
                    values: { count: series.length }
                })}
                description={t({
                    id: 'settings.series.description',
                    message: 'Drag series to change the display order.'
                })}
                actionPosition="right"
                action={series.length > 0 ? createAction : undefined}
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
                    icon={<BookOpen aria-hidden className="h-5 w-5" />}
                    title={t({
                        id: 'settings.series.empty',
                        message: 'No series yet'
                    })}
                    action={createAction}
                />
            )}
        </div>
    );
};

export default SeriesSetting;
