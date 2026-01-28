import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';

export const IframeNodeView = ({ node }: NodeViewProps) => {
    const { src, aspectRatio, align, caption } = node.attrs;

    // aspect-ratio를 CSS 형식으로 변환 (16:9 -> 16 / 9)
    const aspectRatioCSS = aspectRatio ? aspectRatio.replace(':', ' / ') : '16 / 9';

    // figure 정렬 스타일
    const getFigureStyle = (): React.CSSProperties => {
        const baseStyle: React.CSSProperties = {
            width: '100%',
            margin: 0,
            display: 'flex',
            flexDirection: 'column'
        };

        switch (align) {
            case 'left':
                return {
                    ...baseStyle,
                    alignItems: 'flex-start'
                };
            case 'right':
                return {
                    ...baseStyle,
                    alignItems: 'flex-end'
                };
            case 'center':
            default:
                return {
                    ...baseStyle,
                    alignItems: 'center'
                };
        }
    };

    return (
        <NodeViewWrapper>
            <figure style={getFigureStyle()}>
                {/* iframe 컨테이너 - 클릭 이벤트 차단용 오버레이 포함 */}
                <div
                    style={{
                        position: 'relative',
                        width: '100%'
                    }}>
                    <iframe
                        src={src}
                        style={{
                            width: '100%',
                            aspectRatio: aspectRatioCSS,
                            border: 0,
                            pointerEvents: 'none' // iframe 자체의 이벤트 차단
                        }}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    />
                    {/* 투명 오버레이 - 클릭 시 노드 선택되도록 */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            zIndex: 10,
                            cursor: 'pointer',
                            background: 'transparent'
                        }}
                    />
                </div>
                {caption && (
                    <figcaption
                        style={{
                            marginTop: '8px',
                            fontSize: '14px',
                            color: '#666'
                        }}>
                        {caption}
                    </figcaption>
                )}
            </figure>
        </NodeViewWrapper>
    );
};
