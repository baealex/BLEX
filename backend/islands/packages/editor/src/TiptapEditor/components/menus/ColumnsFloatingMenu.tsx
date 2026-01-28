import React, { useState, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import * as Popover from '@radix-ui/react-popover';
import type { ColumnLayout } from '../../extensions/ColumnsNode';
import { layoutToColumnCount } from '../../extensions/ColumnsNode';

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

            // 현재 직접 선택된 노드가 미디어 노드이면 이 메뉴를 숨김
            const directNode = doc.nodeAt(from);
            if (directNode && ['image', 'video', 'iframe'].includes(directNode.type.name)) {
                setIsOpen(false);
                setSelectedNode(null);
                setAnchorElement(null);
                return;
            }

            // Find if we're inside a columns node
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

    const handleAddColumn = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        editor.chain().focus().addColumn().run();
    };

    const handleRemoveColumn = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        editor.chain().focus().removeColumn().run();
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

    const currentLayout = selectedNode.attrs.layout as ColumnLayout;
    const columnCount = selectedNode.columnCount;
    const currentLayouts = columnCount === 2 ? twoColumnLayouts : threeColumnLayouts;

    return (
        <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
            <Popover.Anchor virtualRef={{ current: anchorElement }} />
            <Popover.Portal>
                <Popover.Content
                    className="z-[1100] bg-white/95 backdrop-blur-xl rounded-xl shadow-lg border border-gray-200/60 p-3 flex flex-col gap-3 outline-none"
                    side="top"
                    sideOffset={10}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    onCloseAutoFocus={(e) => e.preventDefault()}
                    onMouseDown={(e) => {
                        if (
                            e.target instanceof HTMLElement &&
                            !['INPUT', 'SELECT'].includes(e.target.tagName)
                        ) {
                            e.preventDefault();
                        }
                        e.stopPropagation();
                    }}
                    onClick={(e) => e.stopPropagation()}>
                    {/* Row 1: Column count control */}
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-700">컬럼 수</span>
                            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                                <button
                                    type="button"
                                    onClick={handleRemoveColumn}
                                    disabled={columnCount <= 2}
                                    className={`
                                        w-7 h-7 rounded-md flex items-center justify-center text-sm transition-all
                                        ${columnCount <= 2
                                            ? 'text-gray-300 cursor-not-allowed'
                                            : 'text-gray-600 hover:bg-white hover:shadow-sm active:scale-95'}
                                    `}
                                    title="컬럼 줄이기">
                                    <i className="fas fa-minus text-xs" />
                                </button>
                                <span className="w-6 text-center text-sm font-medium text-gray-900">
                                    {columnCount}
                                </span>
                                <button
                                    type="button"
                                    onClick={handleAddColumn}
                                    disabled={columnCount >= 3}
                                    className={`
                                        w-7 h-7 rounded-md flex items-center justify-center text-sm transition-all
                                        ${columnCount >= 3
                                            ? 'text-gray-300 cursor-not-allowed'
                                            : 'text-gray-600 hover:bg-white hover:shadow-sm active:scale-95'}
                                    `}
                                    title="컬럼 늘리기">
                                    <i className="fas fa-plus text-xs" />
                                </button>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleDeleteColumns}
                            className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="컬럼 삭제">
                            <i className="fas fa-trash-alt text-xs" />
                        </button>
                    </div>

                    {/* Row 2: Layout presets */}
                    <div className="flex flex-col gap-1.5">
                        <span className="text-xs text-gray-500">비율</span>
                        <div className="flex gap-1">
                            {currentLayouts.map((preset) => {
                                const isActive = currentLayout === preset.value ||
                                    (layoutToColumnCount[currentLayout] !== columnCount && preset.value === currentLayouts[0].value);

                                return (
                                    <button
                                        key={preset.value}
                                        type="button"
                                        onClick={(e) => handleLayoutChange(e, preset.value)}
                                        className={`
                                            flex-1 h-10 rounded-lg flex flex-col items-center justify-center gap-1 transition-all
                                            ${isActive
                                                ? 'bg-gray-900 text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95'}
                                        `}
                                        title={preset.label}>
                                        <LayoutPreview layout={preset.value} active={isActive} />
                                        <span className="text-[10px] font-medium">{preset.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
};

// Visual preview component for layouts
const LayoutPreview = ({ layout, active }: { layout: ColumnLayout; active: boolean }) => {
    const getColumns = () => {
        switch (layout) {
            case '1:1':
                return [1, 1];
            case '1:2':
                return [1, 2];
            case '2:1':
                return [2, 1];
            case '1:1:1':
                return [1, 1, 1];
            case '1:2:1':
                return [1, 2, 1];
            case '2:1:1':
                return [2, 1, 1];
            case '1:1:2':
                return [1, 1, 2];
            default:
                return [1, 1];
        }
    };

    const columns = getColumns();
    const total = columns.reduce((a, b) => a + b, 0);

    return (
        <div className="flex gap-0.5 h-3">
            {columns.map((ratio, i) => (
                <div
                    key={i}
                    className={`h-full rounded-sm ${active ? 'bg-white/60' : 'bg-gray-400'}`}
                    style={{ width: `${(ratio / total) * 36}px` }}
                />
            ))}
        </div>
    );
};

export default ColumnsFloatingMenu;
