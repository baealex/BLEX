import type { DragEndEvent } from '@dnd-kit/core';
import { Trans, useLingui } from '@lingui/react/macro';
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
import { Pencil, Power, Trash2 } from '@blex/ui/icons';

import { Dropdown } from '~/components/shared';
import { SETTINGS_LIST_TITLE } from '~/styles/settingsStyles';
import { SettingsListItem } from '../../../components';
import type { GlobalBannerData } from '~/lib/api/settings';
import {
    bannerPositionMessages,
    bannerTypeMessages
} from '../../shared/bannerI18n';

interface GlobalBannerListProps {
    banners: GlobalBannerData[];
    onEdit: (bannerId: number) => void;
    onDelete: (id: number) => void;
    onToggleActive: (banner: GlobalBannerData) => void;
    onReorder: (banners: GlobalBannerData[]) => void;
}

interface SortableBannerItemProps {
    banner: GlobalBannerData;
    onEdit: (bannerId: number) => void;
    onDelete: (id: number) => void;
    onToggleActive: (banner: GlobalBannerData) => void;
}

const SortableBannerItem = ({ banner, onEdit, onDelete, onToggleActive }: SortableBannerItemProps) => {
    const { i18n, t } = useLingui();
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

    return (
        <div ref={setNodeRef} style={style} className="mb-3">
            <SettingsListItem
                onClick={() => onEdit(banner.id)}
                dragHandleProps={{
                    attributes,
                    listeners,
                    ariaLabel: i18n._({
                        id: 'settings.banners.list.global_reorder_label',
                        message: 'Reorder global banner “{title}”',
                        values: { title: banner.title }
                    })
                }}
                actions={
                    <Dropdown
                        density="compact"
                        triggerAriaLabel={i18n._({
                            id: 'settings.banners.list.global_menu_label',
                            message: 'Open menu for global banner “{title}”',
                            values: { title: banner.title }
                        })}
                        triggerClassName="min-h-11 min-w-11 [@media(pointer:fine)]:min-h-9 [@media(pointer:fine)]:min-w-9"
                        items={[
                            {
                                label: banner.isActive
                                    ? t({
                                        id: 'settings.banners.action.deactivate',
                                        message: 'Deactivate'
                                    })
                                    : t({
                                        id: 'settings.banners.action.activate',
                                        message: 'Activate'
                                    }),
                                icon: <Power aria-hidden="true" className="h-4 w-4" />,
                                onClick: () => onToggleActive(banner)
                            },
                            {
                                label: t({
                                    id: 'common.edit',
                                    message: 'Edit'
                                }),
                                icon: <Pencil aria-hidden="true" className="h-4 w-4" />,
                                onClick: () => onEdit(banner.id)
                            },
                            {
                                label: t({
                                    id: 'common.delete',
                                    message: 'Delete'
                                }),
                                icon: <Trash2 aria-hidden="true" className="h-4 w-4" />,
                                onClick: () => onDelete(banner.id),
                                variant: 'danger'
                            }
                        ]}
                    />
                }>
                <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`${SETTINGS_LIST_TITLE} mb-0`}>
                            {banner.title}
                        </h3>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-subtle text-content border border-line">
                            {i18n._(bannerPositionMessages[banner.position])}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-subtle text-content border border-line">
                            {i18n._(bannerTypeMessages[banner.bannerType])}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${banner.isActive ? 'bg-action text-content-inverted border-line-strong' : 'bg-surface-subtle text-content-secondary border-line-light'}`}>
                            {banner.isActive
                                ? <Trans id="settings.banners.status.active">Active</Trans>
                                : <Trans id="settings.banners.status.inactive">Inactive</Trans>}
                        </span>
                        {banner.createdBy && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-subtle text-content border border-line">
                                {banner.createdBy}
                            </span>
                        )}
                    </div>

                    <p className="text-xs text-content-secondary leading-relaxed line-clamp-2 break-all">
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
