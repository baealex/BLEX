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
}

export const PinnedPostList = ({
    pinnedPosts,
    username,
    onReorder,
    onRemove
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
                iconClassName="fas fa-thumbtack"
                title="고정된 글이 없습니다"
                description="프로필에 표시할 대표 글을 선택해보세요."
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
                <div className="space-y-3">
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
