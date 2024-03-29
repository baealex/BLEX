import { DndContext, DragEndEvent, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from '@dnd-kit/modifiers';

interface VerticalSortableProps {
    items: string[];
    children: React.ReactNode;
    onDragEnd: (event: DragEndEvent) => void;
}

export function VerticalSortable({
    items,
    onDragEnd,
    children
}: VerticalSortableProps) {
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates
        })
    );

    return (
        <DndContext
            sensors={sensors}
            modifiers={[
                restrictToVerticalAxis,
                restrictToFirstScrollableAncestor
            ]}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}>
            <SortableContext
                items={items}
                strategy={verticalListSortingStrategy}>
                {children}
            </SortableContext>
        </DndContext>
    );

}