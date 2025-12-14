import React, { useState, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import * as Popover from '@radix-ui/react-popover';

interface MediaFloatingMenuProps {
    editor: Editor | null;
}

const MediaFloatingMenu = ({ editor }: MediaFloatingMenuProps) => {
    const [selectedNode, setSelectedNode] = useState<{ type: string; attrs: Record<string, unknown>; pos: number } | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);

    useEffect(() => {
        if (!editor) return;

        const updateMenu = () => {
            const { selection, doc } = editor.state;
            const { from } = selection;

            // 현재 선택된 노드 찾기
            const node = doc.nodeAt(from);
            if (node && (node.type.name === 'image' || node.type.name === 'video')) {
                const newSelectedNode = {
                    type: node.type.name,
                    attrs: node.attrs,
                    pos: from
                };

                // 노드가 실제로 변경되었을 때만 업데이트
                if (!selectedNode ||
                    selectedNode.pos !== newSelectedNode.pos ||
                    JSON.stringify(selectedNode.attrs) !== JSON.stringify(newSelectedNode.attrs)) {
                    setSelectedNode(newSelectedNode);
                }

                // 노드의 DOM 요소를 anchor로 설정
                const nodeDOM = editor.view.nodeDOM(from) as HTMLElement;
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

    const updateAttribute = (attr: string, value: unknown) => {
        if (selectedNode) {
            editor.chain().updateAttributes(selectedNode.type, { [attr]: value }).run();
        }
    };

    const handleAlignChange = (e: React.MouseEvent, align: string) => {
        e.preventDefault();
        e.stopPropagation();
        updateAttribute('align', align);
    };

    const handleObjectFitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        e.preventDefault();
        e.stopPropagation();
        updateAttribute('objectFit', e.target.value);
    };

    const handleSizeChange = (dimension: string, value: string) => {
        const numValue = value.trim() === '' ? null : parseInt(value) || null;
        updateAttribute(dimension, numValue);
    };

    const handleCaptionChange = (caption: string) => {
        updateAttribute('caption', caption.trim() === '' ? null : caption);
    };

    const handleToggle = (e: React.MouseEvent, attr: string) => {
        e.preventDefault();
        e.stopPropagation();
        updateAttribute(attr, !selectedNode.attrs[attr]);
    };

    const handleAspectRatioChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        e.preventDefault();
        e.stopPropagation();
        const value = e.target.value;
        updateAttribute('aspectRatio', value === '' ? null : value);
    };

    const handleBorderRadiusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        e.preventDefault();
        e.stopPropagation();
        const value = e.target.value;
        updateAttribute('borderRadius', value === '' ? null : value);
    };

    const IconButton = ({
        icon,
        active,
        onClick,
        title
    }: {
        icon: string;
        active?: boolean;
        onClick: (e: React.MouseEvent) => void;
        title: string;
    }) => (
        <button
            type="button"
            onClick={onClick}
            className={`
                w-7 h-7 rounded-md flex items-center justify-center transition-all
                ${active
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }
            `}
            title={title}>
            <i className={`${icon} text-sm`} />
        </button>
    );

    return (
        <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
            <Popover.Anchor virtualRef={{ current: anchorElement }} />
            <Popover.Portal>
                <Popover.Content
                    className="z-[1100] bg-white/95 backdrop-blur-xl rounded-xl shadow-lg border border-gray-200/60 p-2.5 flex flex-col gap-2.5 outline-none"
                    side="top"
                    sideOffset={10}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    onCloseAutoFocus={(e) => e.preventDefault()}
                    onMouseDown={(e) => {
                        if (e.target instanceof HTMLElement &&
                            !['INPUT', 'SELECT'].includes(e.target.tagName)) {
                            e.preventDefault();
                        }
                        e.stopPropagation();
                    }}
                    onClick={(e) => e.stopPropagation()}>
                    {/* Row 1: 정렬 + 스타일 */}
                    <div className="flex items-center gap-2">
                        {/* 정렬 */}
                        <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
                            <IconButton icon="fas fa-align-left" active={selectedNode.attrs.align === 'left'} onClick={(e) => handleAlignChange(e, 'left')} title="왼쪽 정렬" />
                            <IconButton icon="fas fa-align-center" active={selectedNode.attrs.align === 'center'} onClick={(e) => handleAlignChange(e, 'center')} title="가운데 정렬" />
                            <IconButton icon="fas fa-align-right" active={selectedNode.attrs.align === 'right'} onClick={(e) => handleAlignChange(e, 'right')} title="오른쪽 정렬" />
                        </div>

                        {selectedNode.type === 'image' && (
                            <>
                                <div className="w-px h-5 bg-gray-300" />

                                {/* Object Fit */}
                                <select
                                    value={selectedNode.attrs.objectFit as string || 'cover'}
                                    onChange={handleObjectFitChange}
                                    className="px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                                    <option value="cover">맞춤</option>
                                    <option value="contain">포함</option>
                                    <option value="fill">채움</option>
                                    <option value="none">원본</option>
                                </select>

                                <div className="w-px h-5 bg-gray-300" />

                                {/* 스타일 옵션 */}
                                <div className="flex gap-0.5">
                                    <IconButton icon="fas fa-border-style" active={!!selectedNode.attrs.border} onClick={(e) => handleToggle(e, 'border')} title="테두리" />
                                    <IconButton icon="fas fa-clone" active={!!selectedNode.attrs.shadow} onClick={(e) => handleToggle(e, 'shadow')} title="그림자" />
                                </div>

                                <div className="w-px h-5 bg-gray-300" />

                                {/* Border Radius */}
                                <select
                                    value={selectedNode.attrs.borderRadius as string || ''}
                                    onChange={handleBorderRadiusChange}
                                    className="px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                                    <option value="">둥글기</option>
                                    <option value="0">각짐</option>
                                    <option value="4">약간</option>
                                    <option value="8">보통</option>
                                    <option value="16">많이</option>
                                    <option value="9999">원형</option>
                                </select>
                            </>
                        )}
                    </div>

                    {/* Row 2: 비율 + 크기 */}
                    <div className="flex items-center gap-2">
                        {selectedNode.type === 'image' && (
                            <>
                                <select
                                    value={selectedNode.attrs.aspectRatio as string || ''}
                                    onChange={handleAspectRatioChange}
                                    className="px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                                    <option value="">비율</option>
                                    <option value="16:9">16:9</option>
                                    <option value="4:3">4:3</option>
                                    <option value="1:1">1:1</option>
                                    <option value="3:2">3:2</option>
                                    <option value="21:9">21:9</option>
                                </select>
                                <div className="w-px h-5 bg-gray-300" />
                            </>
                        )}

                        <div className="flex items-center gap-1">
                            <input
                                type="number"
                                placeholder="W"
                                value={selectedNode.attrs.width as number || ''}
                                onChange={(e) => handleSizeChange('width', e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.currentTarget.blur();
                                    }
                                }}
                                className="w-14 px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded-md text-center hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                            <span className="text-gray-400 text-xs">×</span>
                            <input
                                type="number"
                                placeholder="H"
                                value={selectedNode.attrs.height as number || ''}
                                onChange={(e) => handleSizeChange('height', e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.currentTarget.blur();
                                    }
                                }}
                                className="w-14 px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded-md text-center hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    {/* Row 3: 캡션 */}
                    <input
                        type="text"
                        placeholder="캡션..."
                        value={selectedNode.attrs.caption as string || ''}
                        onChange={(e) => handleCaptionChange(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.currentTarget.blur();
                            }
                        }}
                        className="w-full px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
};

export default MediaFloatingMenu;
