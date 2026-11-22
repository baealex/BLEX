import React, { useState, useEffect, useId, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import * as Popover from '@radix-ui/react-popover';
import { useEditorI18n } from '../../i18n';

interface MediaFloatingMenuProps {
    editor: Editor | null;
}

const MEDIA_TYPES = ['image', 'video', 'iframe'];
const fieldClassName = 'px-2 py-1 text-xs bg-surface-elevated text-content border border-line rounded-md hover:bg-surface-subtle focus:outline-none focus:ring-2 focus:ring-action/20 focus:border-action placeholder:text-content-hint';
const dividerClassName = 'w-px h-5 bg-line';
const mediaTypesWithStyle = ['image', 'video'];

const MediaFloatingMenu = ({ editor }: MediaFloatingMenuProps) => {
    const { t } = useEditorI18n();
    const [selectedNode, setSelectedNode] = useState<{ type: string; attrs: Record<string, unknown>; pos: number } | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);
    const altInputId = useId();
    const captionInputId = useId();

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

    const handleAltChange = (alt: string) => {
        updateAttribute('alt', alt.trim() === '' ? null : alt);
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
            title={title}
            aria-label={title}>
            <i aria-hidden className={`${icon} text-sm`} />
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
                                title={t('media.settings')}
                                aria-label={t('media.settings')}>
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
                                    <IconButton icon="fas fa-align-left" active={selectedNode.attrs.align === 'left'} onClick={(e) => handleAlignChange(e, 'left')} title={t('media.align.left')} />
                                    <IconButton icon="fas fa-align-center" active={selectedNode.attrs.align === 'center'} onClick={(e) => handleAlignChange(e, 'center')} title={t('media.align.center')} />
                                    <IconButton icon="fas fa-align-right" active={selectedNode.attrs.align === 'right'} onClick={(e) => handleAlignChange(e, 'right')} title={t('media.align.right')} />
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
                                        <option value="">{t('media.size.original')}</option>
                                        <option value="full">{t('media.size.full')}</option>
                                        <option value="large">{t('media.size.large')}</option>
                                        <option value="medium">{t('media.size.medium')}</option>
                                        <option value="small">{t('media.size.small')}</option>
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
                                        <option value="16:9">16:9 ({t('media.ratio.wide')})</option>
                                        <option value="4:3">4:3 ({t('media.ratio.standard')})</option>
                                        <option value="21:9">21:9 ({t('media.ratio.cinema')})</option>
                                        <option value="1:1">1:1 ({t('media.ratio.square')})</option>
                                    </>
                                ) : (
                                    <>
                                        <option value="">{t('media.ratio.label')}</option>
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
                                        <option value="gif">{t('media.play.gif')}</option>
                                        <option value="video">{t('media.play.video')}</option>
                                    </select>
                                </>
                            )}
                        </div>

                        {/* 스타일 (image, video) */}
                        {mediaTypesWithStyle.includes(selectedNode.type) && (
                            <div className="flex items-center gap-2">
                                <select
                                    value={selectedNode.attrs.objectFit as string || 'cover'}
                                    onChange={handleObjectFitChange}
                                    className={fieldClassName}>
                                    <option value="cover">{t('media.fit.cover')}</option>
                                    <option value="contain">{t('media.fit.contain')}</option>
                                    <option value="fill">{t('media.fit.fill')}</option>
                                    <option value="none">{t('media.fit.original')}</option>
                                </select>

                                <div className={dividerClassName} />
                                <div className="flex gap-0.5 bg-surface-subtle rounded-lg p-0.5">
                                    <IconButton icon="fas fa-border-all" active={!!selectedNode.attrs.border} onClick={(e) => handleToggle(e, 'border')} title={t('media.border')} />
                                    <IconButton icon="fas fa-clone" active={!!selectedNode.attrs.shadow} onClick={(e) => handleToggle(e, 'shadow')} title={t('media.shadow')} />
                                </div>

                                <div className={dividerClassName} />
                                <select
                                    value={selectedNode.attrs.borderRadius as string || ''}
                                    onChange={handleBorderRadiusChange}
                                    className={fieldClassName}>
                                    <option value="">{t('media.radius.label')}</option>
                                    <option value="0">{t('media.radius.square')}</option>
                                    <option value="4">{t('media.radius.slight')}</option>
                                    <option value="8">{t('media.radius.medium')}</option>
                                    <option value="16">{t('media.radius.large')}</option>
                                    <option value="9999">{t('media.radius.round')}</option>
                                </select>
                            </div>
                        )}

                        <div className="grid gap-2">
                            {selectedNode.type === 'image' && (
                                <label htmlFor={altInputId} className="flex items-center gap-2">
                                    <span className="w-20 shrink-0 text-xs font-medium text-content-secondary">
                                        {t('media.alt.label')}
                                    </span>
                                    <input
                                        id={altInputId}
                                        type="text"
                                        placeholder={t('media.alt.placeholder')}
                                        value={selectedNode.attrs.alt as string || ''}
                                        onChange={(e) => handleAltChange(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.currentTarget.blur();
                                            }
                                        }}
                                        className={`min-w-0 flex-1 ${fieldClassName}`}
                                    />
                                </label>
                            )}

                            <label htmlFor={captionInputId} className="flex items-center gap-2">
                                <span className="w-20 shrink-0 text-xs font-medium text-content-secondary">
                                    {t('media.caption.label')}
                                </span>
                                <input
                                    id={captionInputId}
                                    type="text"
                                    placeholder={t('media.caption.placeholder')}
                                    value={selectedNode.attrs.caption as string || ''}
                                    onChange={(e) => handleCaptionChange(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.currentTarget.blur();
                                        }
                                    }}
                                    className={`min-w-0 flex-1 ${fieldClassName}`}
                                />
                            </label>
                        </div>
                    </Popover.Content>
                </Popover.Portal>
            </Popover.Root>
        </>
    );
};

export default MediaFloatingMenu;
