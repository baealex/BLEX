import React, { useState, useEffect } from 'react';
import type { Editor } from '@tiptap/react';

interface MediaFloatingMenuProps {
    editor: Editor | null;
}

const MediaFloatingMenu: React.FC<MediaFloatingMenuProps> = ({ editor }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState({
        top: 0,
        left: 0
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [selectedNode, setSelectedNode] = useState<{ type: string; attrs: any; pos: number } | null>(null);

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

                setIsVisible(true);

                // 노드의 DOM 요소 찾아서 위치 계산
                const nodeDOM = editor.view.nodeDOM(from) as HTMLElement;
                if (nodeDOM) {
                    const rect = nodeDOM.getBoundingClientRect();
                    setPosition({
                        top: rect.top - 60,
                        left: rect.left + rect.width / 2 - 150
                    });
                }
            } else {
                setIsVisible(false);
                setSelectedNode(null);
            }
        };

        editor.on('selectionUpdate', updateMenu);
        editor.on('transaction', updateMenu);

        return () => {
            editor.off('selectionUpdate', updateMenu);
            editor.off('transaction', updateMenu);
        };
    }, [editor]);

    if (!isVisible || !selectedNode || !editor) return null;

    const updateAttribute = (attr: string, value: unknown) => {
        if (selectedNode) {
            // focus() 호출하지 않고 직접 업데이트
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

    return (
        <div
            className="media-floating-menu"
            onMouseDown={(e) => {
                // 입력 필드가 아닌 경우에만 preventDefault
                if (e.target instanceof HTMLElement &&
                    !['INPUT', 'SELECT'].includes(e.target.tagName)) {
                    e.preventDefault();
                }
                e.stopPropagation();
            }}
            onClick={(e) => {
                e.stopPropagation();
            }}
            style={{
                position: 'fixed',
                top: position.top,
                left: position.left,
                zIndex: 1100,
                background: 'var(--color-white)',
                border: '1px solid var(--color-border-default)',
                borderRadius: '8px',
                padding: '12px',
                boxShadow: '0 4px 12px var(--color-shadow-sm)',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                fontSize: '14px'
            }}>
            {/* 정렬 버튼 */}
            <div
                className="align-group"
                style={{
                    display: 'flex',
                    gap: '4px'
                }}>
                <button
                    type="button"
                    onClick={(e) => handleAlignChange(e, 'left')}
                    className={selectedNode.attrs.align === 'left' ? 'active' : ''}
                    style={{
                        padding: '4px 8px',
                        border: '1px solid var(--color-border-light)',
                        background: selectedNode.attrs.align === 'left' ? 'var(--color-interactive-primary)' : 'var(--color-white)',
                        color: selectedNode.attrs.align === 'left' ? 'var(--color-text-inverted)' : 'var(--color-text-primary)',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}>
                    왼쪽
                </button>
                <button
                    type="button"
                    onClick={(e) => handleAlignChange(e, 'center')}
                    className={selectedNode.attrs.align === 'center' ? 'active' : ''}
                    style={{
                        padding: '4px 8px',
                        border: '1px solid var(--color-border-light)',
                        background: selectedNode.attrs.align === 'center' ? 'var(--color-interactive-primary)' : 'var(--color-white)',
                        color: selectedNode.attrs.align === 'center' ? 'var(--color-text-inverted)' : 'var(--color-text-primary)',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}>
                    가운데
                </button>
                <button
                    type="button"
                    onClick={(e) => handleAlignChange(e, 'right')}
                    className={selectedNode.attrs.align === 'right' ? 'active' : ''}
                    style={{
                        padding: '4px 8px',
                        border: '1px solid var(--color-border-light)',
                        background: selectedNode.attrs.align === 'right' ? 'var(--color-interactive-primary)' : 'var(--color-white)',
                        color: selectedNode.attrs.align === 'right' ? 'var(--color-text-inverted)' : 'var(--color-text-primary)',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}>
                    오른쪽
                </button>
            </div>

            {/* 구분선 */}
            <div
                style={{
                    width: '1px',
                    height: '24px',
                    background: 'var(--color-border-light)'
                }}
            />

            {/* Object Fit (이미지만) */}
            {selectedNode.type === 'image' && (
                <>
                    <select
                        value={selectedNode.attrs.objectFit || 'cover'}
                        onChange={handleObjectFitChange}
                        style={{
                            padding: '4px 8px',
                            border: '1px solid var(--color-border-light)',
                            borderRadius: '4px'
                        }}>
                        <option value="cover">맞춤</option>
                        <option value="contain">포함</option>
                        <option value="fill">채움</option>
                        <option value="none">원본</option>
                    </select>

                    <div
                        style={{
                            width: '1px',
                            height: '24px',
                            background: 'var(--color-border-light)'
                        }}
                    />
                </>
            )}

            {/* 크기 조절 */}
            <input
                type="number"
                placeholder="너비"
                value={selectedNode.attrs.width || ''}
                onChange={(e) => {
                    handleSizeChange('width', e.target.value);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.currentTarget.blur();
                    }
                }}
                style={{
                    width: '60px',
                    padding: '4px',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '4px'
                }}
            />
            <span>×</span>
            <input
                type="number"
                placeholder="높이"
                value={selectedNode.attrs.height || ''}
                onChange={(e) => {
                    handleSizeChange('height', e.target.value);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.currentTarget.blur();
                    }
                }}
                style={{
                    width: '60px',
                    padding: '4px',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '4px'
                }}
            />

            <div
                style={{
                    width: '1px',
                    height: '24px',
                    background: 'var(--color-border-light)'
                }}
            />

            {/* 캡션 */}
            <input
                type="text"
                placeholder="설명..."
                value={selectedNode.attrs.caption || ''}
                onChange={(e) => {
                    handleCaptionChange(e.target.value);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.currentTarget.blur();
                    }
                }}
                style={{
                    width: '120px',
                    padding: '4px 8px',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '4px'
                }}
            />
        </div>
    );
};

export default MediaFloatingMenu;
