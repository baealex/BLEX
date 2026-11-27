import type React from 'react';
import { useState, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import { Fragment } from '@tiptap/pm/model';
import * as Popover from '@radix-ui/react-popover';
import type { ColumnLayout } from '../../extensions/ColumnsNode';
import { useEditorI18n } from '../../i18n';
import { InlineIcon, ArrowUp, ArrowDown, Trash2 } from '~/ui/icons';

interface ColumnsFloatingMenuProps {
    editor: Editor | null;
}

const twoColumnLayouts: { value: ColumnLayout; label: string }[] = [
    {
        value: '1:1',
        label: '1:1'
    },
    {
        value: '1:2',
        label: '1:2'
    },
    {
        value: '2:1',
        label: '2:1'
    }
];

const threeColumnLayouts: { value: ColumnLayout; label: string }[] = [
    {
        value: '1:1:1',
        label: '1:1:1'
    },
    {
        value: '1:2:1',
        label: '1:2:1'
    },
    {
        value: '2:1:1',
        label: '2:1:1'
    },
    {
        value: '1:1:2',
        label: '1:1:2'
    }
];

const ColumnsFloatingMenu = ({ editor }: ColumnsFloatingMenuProps) => {
    const { t } = useEditorI18n();
    const [selectedNode, setSelectedNode] = useState<{
        attrs: Record<string, unknown>;
        pos: number;
        columnCount: number;
    } | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);

    useEffect(() => {
        if (!editor) return;

        const updateMenu = () => {
            const { selection, doc } = editor.state;
            const { $from, from } = selection;

            const directNode = doc.nodeAt(from);
            if (directNode && ['image', 'video', 'iframe'].includes(directNode.type.name)) {
                setIsOpen(false);
                setSelectedNode(null);
                setAnchorElement(null);
                return;
            }

            let columnsNode = null;
            let columnsPos: number | null = null;

            for (let depth = $from.depth; depth >= 0; depth--) {
                const node = $from.node(depth);
                if (node.type.name === 'columns') {
                    columnsNode = node;
                    columnsPos = $from.before(depth);
                    break;
                }
            }

            if (columnsNode && columnsPos !== null) {
                const newSelectedNode = {
                    attrs: columnsNode.attrs,
                    pos: columnsPos,
                    columnCount: columnsNode.childCount
                };

                if (
                    !selectedNode ||
                    selectedNode.pos !== newSelectedNode.pos ||
                    selectedNode.columnCount !== newSelectedNode.columnCount ||
                    JSON.stringify(selectedNode.attrs) !== JSON.stringify(newSelectedNode.attrs)
                ) {
                    setSelectedNode(newSelectedNode);
                }

                const nodeDOM = editor.view.nodeDOM(columnsPos) as HTMLElement;
                if (nodeDOM) {
                    setAnchorElement(nodeDOM);
                }

                setIsOpen(true);
            } else {
                setIsOpen(false);
                setSelectedNode(null);
                setAnchorElement(null);
            }
        };

        editor.on('selectionUpdate', updateMenu);
        editor.on('transaction', updateMenu);

        return () => {
            editor.off('selectionUpdate', updateMenu);
            editor.off('transaction', updateMenu);
        };
    }, [editor, selectedNode]);

    if (!isOpen || !selectedNode || !editor || !anchorElement) return null;

    const handleLayoutChange = (e: React.MouseEvent, layout: ColumnLayout) => {
        e.preventDefault();
        e.stopPropagation();
        editor.chain().focus().updateAttributes('columns', { layout }).run();
    };

    const handleDeleteColumns = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const { $from } = editor.state.selection;
        for (let depth = $from.depth; depth >= 0; depth--) {
            const node = $from.node(depth);
            if (node.type.name === 'columns') {
                const pos = $from.before(depth);
                editor
                    .chain()
                    .focus()
                    .command(({ tr }) => {
                        tr.delete(pos, pos + node.nodeSize);
                        return true;
                    })
                    .run();
                break;
            }
        }
    };

    const handleMoveUp = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const { doc } = editor.state;
        const pos = selectedNode.pos;
        const $pos = doc.resolve(pos);
        const index = $pos.index();

        if (index === 0) return;

        const columnsNode = doc.nodeAt(pos);
        if (!columnsNode) return;

        const prevNode = $pos.parent.child(index - 1);
        const prevNodePos = pos - prevNode.nodeSize;
        const rangeEnd = pos + columnsNode.nodeSize;

        const { tr } = editor.state;
        tr.replaceWith(prevNodePos, rangeEnd, Fragment.from([columnsNode, prevNode]));
        editor.view.dispatch(tr);
        editor.commands.focus();
    };

    const handleMoveDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const { doc } = editor.state;
        const pos = selectedNode.pos;
        const $pos = doc.resolve(pos);
        const index = $pos.index();
        const parent = $pos.parent;

        if (index >= parent.childCount - 1) return;

        const columnsNode = doc.nodeAt(pos);
        if (!columnsNode) return;

        const nextNode = parent.child(index + 1);
        const rangeEnd = pos + columnsNode.nodeSize + nextNode.nodeSize;

        const { tr } = editor.state;
        tr.replaceWith(pos, rangeEnd, Fragment.from([nextNode, columnsNode]));
        editor.view.dispatch(tr);
        editor.commands.focus();
    };

    const canMove = (() => {
        const { doc } = editor.state;
        const pos = selectedNode.pos;
        const $pos = doc.resolve(pos);
        const index = $pos.index();
        const parent = $pos.parent;
        return {
            up: index > 0,
            down: index < parent.childCount - 1
        };
    })();

    const currentLayout = selectedNode.attrs.layout as ColumnLayout;
    const columnCount = selectedNode.columnCount;
    const currentLayouts = columnCount === 2 ? twoColumnLayouts : threeColumnLayouts;

    return (
        <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
            <Popover.Anchor virtualRef={{ current: anchorElement }} />
            <Popover.Portal>
                <Popover.Content
                    className="z-[1100] floating-glass-surface rounded-xl p-2 flex items-center gap-2 outline-none"
                    side="top"
                    sideOffset={10}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    onCloseAutoFocus={(e) => e.preventDefault()}
                    onMouseDown={(e) => {
                        if (e.target instanceof HTMLElement && !['INPUT', 'SELECT'].includes(e.target.tagName)) {
                            e.preventDefault();
                        }
                        e.stopPropagation();
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* 비율 프리셋 */}
                    <div className="flex gap-0.5">
                        {currentLayouts.map((preset) => (
                            <button
                                key={preset.value}
                                type="button"
                                onClick={(e) => handleLayoutChange(e, preset.value)}
                                className={`
                                    h-8 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all text-xs font-medium
                                    ${
                                        currentLayout === preset.value
                                            ? 'bg-action text-content-inverted'
                                            : 'bg-floating-glass-hover text-content-secondary hover:text-content active:scale-95'
                                    }
                                `}
                                title={preset.label}
                            >
                                <LayoutPreview layout={preset.value} active={currentLayout === preset.value} />
                                <span>{preset.label}</span>
                            </button>
                        ))}
                    </div>

                    <div className="w-px h-5 bg-line" />

                    {/* 이동 + 삭제 */}
                    <div className="flex items-center gap-0.5">
                        <button
                            type="button"
                            onClick={handleMoveUp}
                            disabled={!canMove.up}
                            className={`
                                w-7 h-7 rounded-md flex items-center justify-center transition-all
                                ${
                                    !canMove.up
                                        ? 'text-content-hint opacity-50 cursor-not-allowed'
                                        : 'text-content-secondary hover:bg-floating-glass-hover hover:text-content active:scale-95'
                                }
                            `}
                            title={t('columns.move_up')}
                        >
                            <InlineIcon icon={ArrowUp} className="text-xs" />
                        </button>
                        <button
                            type="button"
                            onClick={handleMoveDown}
                            disabled={!canMove.down}
                            className={`
                                w-7 h-7 rounded-md flex items-center justify-center transition-all
                                ${
                                    !canMove.down
                                        ? 'text-content-hint opacity-50 cursor-not-allowed'
                                        : 'text-content-secondary hover:bg-floating-glass-hover hover:text-content active:scale-95'
                                }
                            `}
                            title={t('columns.move_down')}
                        >
                            <InlineIcon icon={ArrowDown} className="text-xs" />
                        </button>
                        <button
                            type="button"
                            onClick={handleDeleteColumns}
                            className="w-7 h-7 rounded-md flex items-center justify-center text-content-hint hover:text-danger hover:bg-danger-surface transition-colors"
                            title={t('columns.delete')}
                        >
                            <InlineIcon icon={Trash2} className="text-xs" />
                        </button>
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
};

const LayoutPreview = ({ layout, active }: { layout: ColumnLayout; active: boolean }) => {
    const getColumns = (): Record<string, number> => {
        switch (layout) {
            case '1:1':
                return { left: 1, right: 1 };
            case '1:2':
                return { left: 1, right: 2 };
            case '2:1':
                return { left: 2, right: 1 };
            case '1:1:1':
                return { left: 1, middle: 1, right: 1 };
            case '1:2:1':
                return { left: 1, middle: 2, right: 1 };
            case '2:1:1':
                return { left: 2, middle: 1, right: 1 };
            case '1:1:2':
                return { left: 1, middle: 1, right: 2 };
            default:
                return { left: 1, right: 1 };
        }
    };

    const columns = Object.entries(getColumns());
    const total = columns.reduce((sum, [, ratio]) => sum + ratio, 0);

    return (
        <div className="flex gap-0.5 h-3">
            {columns.map(([position, ratio]) => (
                <div
                    key={position}
                    className={`h-full rounded-sm ${active ? 'bg-content-inverted/60' : 'bg-content-hint'}`}
                    style={{ width: `${(ratio / total) * 24}px` }}
                />
            ))}
        </div>
    );
};

export default ColumnsFloatingMenu;
