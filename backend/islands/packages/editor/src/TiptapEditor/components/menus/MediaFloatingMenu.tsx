import React, { useState, useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import * as Popover from '@radix-ui/react-popover';

interface MediaFloatingMenuProps {
    editor: Editor | null;
}

const MEDIA_TYPES = ['image', 'video', 'iframe'];
const fieldClassName = 'px-2 py-1 text-xs bg-surface-elevated text-content border border-line rounded-md hover:bg-surface-subtle focus:outline-none focus:ring-2 focus:ring-action/20 focus:border-action placeholder:text-content-hint';
const dividerClassName = 'w-px h-5 bg-line';
const mediaTypesWithStyle = ['image', 'video'];

const MediaFloatingMenu = ({ editor }: MediaFloatingMenuProps) => {
    const [selectedNode, setSelectedNode] = useState<{ type: string; attrs: Record<string, unknown>; pos: number } | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);

    const selectedPosRef = useRef<number | null>(null);

    useEffect(() => {
        if (!editor) return;

        const syncSelectedNode = () => {
            const { selection, doc } = editor.state;
            const { from } = selection;
            const node = doc.nodeAt(from);

            if (node && MEDIA_TYPES.includes(node.type.name)) {
                setSelectedNode({
                    type: node.type.name,
                    attrs: node.attrs,
                    pos: from
                });

                const nodeDOM = editor.view.nodeDOM(from) as HTMLElement;
                if (nodeDOM) setAnchorElement(nodeDOM);

                if (selectedPosRef.current !== from) {
                    selectedPosRef.current = from;
                    setIsOpen(false);
                }
            } else {
                selectedPosRef.current = null;
                setIsOpen(false);
                setSelectedNode(null);
                setAnchorElement(null);
            }
        };

        editor.on('selectionUpdate', syncSelectedNode);
        editor.on('transaction', syncSelectedNode);

        return () => {
            editor.off('selectionUpdate', syncSelectedNode);
            editor.off('transaction', syncSelectedNode);
        };
    }, [editor]);

    if (!selectedNode || !editor || !anchorElement) return null;

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

    const handleCaptionChange = (caption: string) => {
        updateAttribute('caption', caption.trim() === '' ? null : caption);
    };

    const handleToggle = (e: React.MouseEvent, attr: string) => {
        e.preventDefault();
        e.stopPropagation();
        updateAttribute(attr, !selectedNode.attrs[attr]);
    };

    const handleObjectFitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        e.preventDefault();
        e.stopPropagation();
        updateAttribute('objectFit', e.target.value);
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

    const handlePlayModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        e.preventDefault();
        e.stopPropagation();
        const mode = e.target.value;
        updateAttribute('playMode', mode);
        if (mode === 'gif') {
            editor.chain()
                .updateAttributes('video', {
                    autoplay: true,
                    muted: true,
                    loop: true
                })
                .run();
        } else {
            editor.chain()
                .updateAttributes('video', {
                    autoplay: false,
                    muted: false,
                    loop: false
                })
                .run();
        }
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
                    ? 'bg-action text-content-inverted'
                    : 'text-content-secondary hover:text-content hover:bg-surface-subtle active:scale-95'
                }
            `}
            title={title}>
            <i className={`${icon} text-sm`} />
        </button>
    );

    return (
        <>
            {/* 설정 아이콘: 노드 선택 시 우하단에 표시 */}
            {!isOpen && (
                <Popover.Root open>
                    <Popover.Anchor virtualRef={{ current: anchorElement }} />
                    <Popover.Portal>
                        <Popover.Content
                            side="bottom"
                            align="end"
                            sideOffset={-36}
                            alignOffset={-8}
                            className="z-[1100] outline-none"
                            onOpenAutoFocus={(e) => e.preventDefault()}>
                            <button
                                type="button"
                                onClick={() => setIsOpen(true)}
                                onMouseDown={(e) => e.preventDefault()}
                                className="w-7 h-7 rounded-full floating-glass-surface flex items-center justify-center text-content-secondary hover:text-content transition-all"
                                title="설정">
                                <i className="fas fa-cog text-xs" />
                            </button>
                        </Popover.Content>
                    </Popover.Portal>
                </Popover.Root>
            )}

            {/* 설정 메뉴: 아이콘 클릭 시 표시 */}
            <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
                <Popover.Anchor virtualRef={{ current: anchorElement }} />
                <Popover.Portal>
                    <Popover.Content
                        className="z-[1100] floating-glass-surface rounded-xl p-2 flex flex-col gap-2 outline-none"
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
                        <div className="flex items-center gap-2">
                            {/* 정렬 (image, video) */}
                            {(selectedNode.type === 'image' || selectedNode.type === 'video') && (
                                <div className="flex gap-0.5 bg-surface-subtle rounded-lg p-0.5">
                                    <IconButton icon="fas fa-align-left" active={selectedNode.attrs.align === 'left'} onClick={(e) => handleAlignChange(e, 'left')} title="왼쪽 정렬" />
                                    <IconButton icon="fas fa-align-center" active={selectedNode.attrs.align === 'center'} onClick={(e) => handleAlignChange(e, 'center')} title="가운데 정렬" />
                                    <IconButton icon="fas fa-align-right" active={selectedNode.attrs.align === 'right'} onClick={(e) => handleAlignChange(e, 'right')} title="오른쪽 정렬" />
                                </div>
                            )}

                            {/* 크기 (image, video) */}
                            {(selectedNode.type === 'image' || selectedNode.type === 'video') && (
                                <>
                                    <div className={dividerClassName} />
                                    <select
                                        value={selectedNode.attrs.sizePreset as string || ''}
                                        onChange={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            updateAttribute('sizePreset', e.target.value || null);
                                        }}
                                        className={fieldClassName}>
                                        <option value="">원본</option>
                                        <option value="full">본문 폭</option>
                                        <option value="large">크게</option>
                                        <option value="medium">보통</option>
                                        <option value="small">작게</option>
                                    </select>
                                </>
                            )}

                            {/* 비율 */}
                            <div className={dividerClassName} />
                            <select
                                value={selectedNode.attrs.aspectRatio as string || (selectedNode.type === 'iframe' ? '16:9' : '')}
                                onChange={handleAspectRatioChange}
                                className={fieldClassName}>
                                {selectedNode.type === 'iframe' ? (
                                    <>
                                        <option value="16:9">16:9 (와이드)</option>
                                        <option value="4:3">4:3 (표준)</option>
                                        <option value="21:9">21:9 (시네마)</option>
                                        <option value="1:1">1:1 (정사각)</option>
                                    </>
                                ) : (
                                    <>
                                        <option value="">비율</option>
                                        <option value="16:9">16:9</option>
                                        <option value="4:3">4:3</option>
                                        <option value="2:1">2:1</option>
                                        <option value="1:1">1:1</option>
                                        <option value="9:16">9:16</option>
                                    </>
                                )}
                            </select>

                            {/* 재생 모드 (video) */}
                            {selectedNode.type === 'video' && (
                                <>
                                    <div className={dividerClassName} />
                                    <select
                                        value={selectedNode.attrs.playMode as string || 'gif'}
                                        onChange={handlePlayModeChange}
                                        className={fieldClassName}>
                                        <option value="gif">움짤</option>
                                        <option value="video">영상</option>
                                    </select>
                                </>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            {/* 스타일 (image, video) */}
                            {mediaTypesWithStyle.includes(selectedNode.type) && (
                                <>
                                    <select
                                        value={selectedNode.attrs.objectFit as string || 'cover'}
                                        onChange={handleObjectFitChange}
                                        className={fieldClassName}>
                                        <option value="cover">맞춤</option>
                                        <option value="contain">포함</option>
                                        <option value="fill">채움</option>
                                        <option value="none">원본</option>
                                    </select>

                                    <div className={dividerClassName} />
                                    <div className="flex gap-0.5 bg-surface-subtle rounded-lg p-0.5">
                                        <IconButton icon="fas fa-border-all" active={!!selectedNode.attrs.border} onClick={(e) => handleToggle(e, 'border')} title="테두리" />
                                        <IconButton icon="fas fa-clone" active={!!selectedNode.attrs.shadow} onClick={(e) => handleToggle(e, 'shadow')} title="그림자" />
                                    </div>

                                    <div className={dividerClassName} />
                                    <select
                                        value={selectedNode.attrs.borderRadius as string || ''}
                                        onChange={handleBorderRadiusChange}
                                        className={fieldClassName}>
                                        <option value="">둥글기</option>
                                        <option value="0">각짐</option>
                                        <option value="4">약간</option>
                                        <option value="8">보통</option>
                                        <option value="16">많이</option>
                                        <option value="9999">원형</option>
                                    </select>

                                    <div className={dividerClassName} />
                                </>
                            )}

                            {/* 캡션 */}
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
                                className={`w-36 ${fieldClassName}`}
                            />
                        </div>
                    </Popover.Content>
                </Popover.Portal>
            </Popover.Root>
        </>
    );
};

export default MediaFloatingMenu;
