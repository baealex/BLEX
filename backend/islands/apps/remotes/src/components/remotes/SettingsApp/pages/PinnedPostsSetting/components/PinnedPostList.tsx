import type { ReactNode } from 'react';
import { Pin } from '@blex/ui/icons';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    type DragEndEvent
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
    sortableKeyboardCoordinates,
    arrayMove
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';
import { SettingsEmptyState } from '../../../components';
import { PinnedPostItem } from './PinnedPostItem';
import type { PinnedPostData } from '~/lib/api/settings';

interface PinnedPostListProps {
    pinnedPosts: PinnedPostData[];
    username: string;
    onReorder: (newPinnedPosts: PinnedPostData[]) => void;
    onRemove: (postUrl: string) => void;
    maxCount: number;
    emptyAction?: ReactNode;
}

export const PinnedPostList = ({
    pinnedPosts,
    username,
    onReorder,
    onRemove,
    emptyAction
}: PinnedPostListProps) => {
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
            const oldIndex = pinnedPosts.findIndex((item) => item.post.url === active.id);
            const newIndex = pinnedPosts.findIndex((item) => item.post.url === over.id);

            const newPinnedPosts = arrayMove(pinnedPosts, oldIndex, newIndex);
            onReorder(newPinnedPosts);
        }
    };

    if (pinnedPosts.length === 0) {
        return (
            <SettingsEmptyState
                icon={<Pin aria-hidden className="h-5 w-5" />}
                title="고정된 포스트가 없습니다"
                action={emptyAction}
            />
        );
    }

    return (
        <DndContext
            sensors={sensors}
            modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}>
            <SortableContext
                items={pinnedPosts.map((item) => item.post.url)}
                strategy={verticalListSortingStrategy}>
                <div>
                    {pinnedPosts.map((item) => (
                        <PinnedPostItem
                            key={item.post.url}
                            pinnedPost={item}
                            username={username}
                            onRemove={onRemove}
                        />
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    );
};
