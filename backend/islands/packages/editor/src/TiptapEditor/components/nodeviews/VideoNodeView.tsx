import { useRef, useEffect } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { getFigureStyle, getMediaStyle } from '../../utils/mediaStyles';

export const VideoNodeView = ({ node, selected }: NodeViewProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const {
        src,
        poster,
        width,
        height,
        align,
        caption,
        objectFit,
        aspectRatio,
        border,
        shadow,
        borderRadius,
        sizePreset,
        playMode,
        autoplay,
        muted,
        loop
    } = node.attrs;

    // 프로그래밍적으로 video 속성 제어 (HTML 어트리뷰트만으로는 muted가 안 먹힘)
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        video.muted = !!muted;
        video.loop = !!loop;
        video.playsInline = true;

        if (autoplay && playMode === 'gif') {
            video.play().catch(() => {
                // 브라우저 자동재생 정책에 의해 차단될 수 있음
            });
        } else if (playMode === 'video') {
            video.pause();
        }
    }, [muted, loop, autoplay, playMode]);

    // playMode 변경 시 재생 상태 동기화
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (playMode === 'gif') {
            video.muted = true;
            video.loop = true;
            video.play().catch(() => {});
        } else {
            video.pause();
        }
    }, [playMode]);

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
                    <video
                        ref={videoRef}
                        draggable={false}
                        style={getMediaStyle({
                            objectFit,
                            aspectRatio,
                            width,
                            height
                        })}
                        poster={poster || undefined}
                        width={width || undefined}
                        height={height || undefined}
                        playsInline>
                        <source src={src} type="video/mp4" />
                    </video>
                    {/* 투명 오버레이: 클릭 시 노드 선택 (네이티브 재생 차단) */}
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
                    {/* 움짤/영상 모드 인디케이터 */}
                    {selected && (
                        <div
                            style={{
                                position: 'absolute',
                                top: 8,
                                left: 8,
                                zIndex: 11,
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 600,
                                background: playMode === 'gif' ? 'rgba(139, 92, 246, 0.85)' : 'rgba(59, 130, 246, 0.85)',
                                color: '#fff',
                                pointerEvents: 'none'
                            }}>
                            {playMode === 'gif' ? '움짤' : '영상'}
                        </div>
                    )}
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
