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
import { PinnedPostItem } from './PinnedPostItem';
import type { PinnedPostData } from '~/lib/api/settings';
import { Button } from '~/components/shared';

interface PinnedPostListProps {
    pinnedPosts: PinnedPostData[];
    username: string;
    onReorder: (newPinnedPosts: PinnedPostData[]) => void;
    onRemove: (postUrl: string) => void;
    onAdd: () => void;
    maxCount: number;
}

export const PinnedPostList = ({
    pinnedPosts,
    username,
    onReorder,
    onRemove,
    onAdd
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
            <div className="text-center py-16 bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-200">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white flex items-center justify-center shadow-sm">
                    <i className="fas fa-thumbtack text-2xl text-gray-300" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">고정된 글이 없습니다</h3>
                <p className="text-gray-500 mb-6 font-medium">프로필에 표시할 대표 글을 선택해보세요.</p>
                <Button
                    variant="primary"
                    size="md"
                    leftIcon={<i className="fas fa-plus" />}
                    onClick={onAdd}>
                    첫 번째 글 고정하기
                </Button>
            </div>
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
