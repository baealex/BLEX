import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { getFigureStyle, getMediaStyle } from '../../utils/mediaStyles';

export const ImageNodeView = ({ node, selected }: NodeViewProps) => {
    const {
        src,
        alt,
        title,
        width,
        height,
        align,
        caption,
        objectFit,
        aspectRatio,
        border,
        shadow,
        borderRadius,
        sizePreset
    } = node.attrs;

    return (
        <NodeViewWrapper>
            <figure
                style={getFigureStyle({
                    align,
                    border,
                    shadow,
                    borderRadius,
                    sizePreset
                })}
                data-border={border ? 'true' : undefined}
                data-shadow={shadow ? 'true' : undefined}
                data-border-radius={borderRadius || undefined}
                data-size={sizePreset || undefined}>
                <div style={{ position: 'relative' }}>
                    <img
                        src={src}
                        alt={alt || ''}
                        title={title || undefined}
                        draggable={false}
                        style={getMediaStyle({
                            objectFit,
                            aspectRatio,
                            width,
                            height
                        })}
                        width={width || undefined}
                        height={height || undefined}
                    />
                    {/* 투명 오버레이: 클릭 시 노드 선택 */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            zIndex: 10,
                            cursor: selected ? 'grab' : 'pointer',
                            background: 'transparent'
                        }}
                    />
                </div>
                {caption && (
                    <figcaption
                        style={{
                            marginTop: 8,
                            fontSize: 14,
                            color: '#666',
                            textAlign: 'center'
                        }}>
                        {caption}
                    </figcaption>
                )}
            </figure>
        </NodeViewWrapper>
    );
};
