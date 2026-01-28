import { Node } from '@tiptap/react';

export const VideoNode = Node.create({
    name: 'video',

    group: 'block',

    atom: true,

    addAttributes() {
        return {
            src: { default: null },
            poster: { default: null },
            width: { default: null },
            height: { default: null },
            align: { default: 'center' }, // left, center, right
            caption: { default: null },
            // 새로운 스타일 속성들 (이미지와 동일)
            objectFit: { default: 'cover' }, // cover, contain, fill, none
            aspectRatio: { default: null }, // 16:9, 4:3, 1:1, 21:9 등
            border: { default: false },
            shadow: { default: false },
            borderRadius: { default: null }, // 0, 4, 8, 16, 9999 (px)
            // 재생 모드: 'gif'(움짤) 또는 'video'(일반 영상)
            playMode: { default: 'gif' },
            autoplay: {
                default: true,
                parseHTML: element => element.hasAttribute('autoplay'),
                renderHTML: attributes => {
                    return attributes.autoplay ? { autoplay: '' } : {};
                }
            },
            muted: {
                default: true,
                parseHTML: element => element.hasAttribute('muted'),
                renderHTML: attributes => {
                    return attributes.muted ? { muted: '' } : {};
                }
            },
            loop: {
                default: true,
                parseHTML: element => element.hasAttribute('loop'),
                renderHTML: attributes => {
                    return attributes.loop ? { loop: '' } : {};
                }
            },
            playsinline: {
                default: true,
                parseHTML: element => element.hasAttribute('playsinline'),
                renderHTML: attributes => {
                    return attributes.playsinline ? { playsinline: '' } : {};
                }
            }
        };
    },

    parseHTML() {
        return [
            // figure > video 구조
            {
                tag: 'figure',
                getAttrs: (element) => {
                    const figure = element as HTMLElement;
                    const video = figure.querySelector('video');
                    const caption = figure.querySelector('figcaption');

                    if (!video) return false;

                    const source = video.querySelector('source');

                    // data-src가 있으면 즉시 src로 사용 (lazy 로딩 제거)
                    let finalSrc = video.src || source?.src || null;
                    const dataSrc = source?.getAttribute('data-src') || video.getAttribute('data-src') || null;
                    if (dataSrc) {
                        finalSrc = dataSrc;
                    }

                    // playMode 판단: controls가 있으면 video, 없으면 gif
                    const hasControls = video.hasAttribute('controls');
                    const playMode = hasControls ? 'video' : 'gif';

                    return {
                        src: finalSrc,
                        poster: video.poster || null,
                        width: video.width || null,
                        height: video.height || null,
                        align: figure.style.textAlign || figure.getAttribute('data-align') || 'center',
                        caption: caption?.textContent || null,
                        objectFit: video.style.objectFit || 'cover',
                        aspectRatio: video.getAttribute('data-aspect-ratio') || null,
                        border: figure.getAttribute('data-border') === 'true',
                        shadow: figure.getAttribute('data-shadow') === 'true',
                        borderRadius: figure.getAttribute('data-border-radius') || null,
                        playMode,
                        autoplay: !hasControls,
                        muted: !hasControls,
                        loop: !hasControls,
                        playsinline: true
                    };
                }
            },
            // 단독 video 태그
            {
                tag: 'video',
                getAttrs: (element) => {
                    const video = element as HTMLVideoElement;
                    const source = video.querySelector('source');

                    // data-src가 있으면 즉시 src로 사용 (lazy 로딩 제거)
                    let finalSrc = video.src || source?.src || null;
                    const dataSrc = source?.getAttribute('data-src') || video.getAttribute('data-src') || null;
                    if (dataSrc) {
                        finalSrc = dataSrc;
                    }

                    // playMode 판단: controls가 있으면 video, 없으면 gif
                    const hasControls = video.hasAttribute('controls');
                    const playMode = hasControls ? 'video' : 'gif';

                    return {
                        src: finalSrc,
                        poster: video.poster || null,
                        width: video.width || null,
                        height: video.height || null,
                        align: 'center',
                        caption: null,
                        objectFit: video.style.objectFit || 'cover',
                        aspectRatio: video.getAttribute('data-aspect-ratio') || null,
                        border: false,
                        shadow: false,
                        borderRadius: null,
                        playMode,
                        autoplay: !hasControls,
                        muted: !hasControls,
                        loop: !hasControls,
                        playsinline: true
                    };
                }
            }
        ];
    },

    renderHTML({ HTMLAttributes }) {
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
            playMode
        } = HTMLAttributes;

        // 비디오 속성 설정
        const videoAttrs: Record<string, string> = { playsinline: '' };

        // playMode에 따라 재생 속성 결정
        if (playMode === 'gif') {
            // 움짤 모드: 자동재생, 음소거, 반복
            videoAttrs.autoplay = '';
            videoAttrs.muted = '';
            videoAttrs.loop = '';
        } else {
            // 비디오 모드: 컨트롤 표시
            videoAttrs.controls = '';
        }

        if (poster) videoAttrs.poster = poster;
        if (width) videoAttrs.width = width;
        if (height) videoAttrs.height = height;

        // 비디오 스타일
        const videoStyles: string[] = [];
        if (aspectRatio) {
            videoStyles.push(`aspect-ratio: ${aspectRatio.replace(':', ' / ')}`);
            if (!width && !height) {
                videoStyles.push('width: 100%');
            }
            videoAttrs['data-aspect-ratio'] = aspectRatio;
        }
        if (objectFit) {
            videoStyles.push(`object-fit: ${objectFit}`);
        }
        if (videoStyles.length > 0) {
            videoAttrs.style = videoStyles.join('; ');
        }

        const sourceAttrs: Record<string, string> = { type: 'video/mp4' };
        if (src) sourceAttrs.src = src;

        // figure 스타일
        const figureStyles: string[] = [];
        const figureAttrs: Record<string, string> = {};

        if (align) {
            figureStyles.push(`text-align: ${align}`);
            if (align === 'center') {
                figureStyles.push('display: flex', 'justify-content: center', 'flex-direction: column', 'align-items: center');
            } else if (align === 'left') {
                figureStyles.push('display: flex', 'justify-content: flex-start', 'flex-direction: column', 'align-items: flex-start');
            } else if (align === 'right') {
                figureStyles.push('display: flex', 'justify-content: flex-end', 'flex-direction: column', 'align-items: flex-end');
            }
        }

        if (border) {
            figureStyles.push('border: 1px solid #e5e7eb', 'overflow: hidden');
            figureAttrs['data-border'] = 'true';
        }
        if (shadow) {
            figureStyles.push('box-shadow: 8px 8px 40px 2px rgba(0, 0, 0, 0.15)');
            figureAttrs['data-shadow'] = 'true';
        }
        if (borderRadius) {
            figureStyles.push(`border-radius: ${borderRadius}px`, 'overflow: hidden');
            figureAttrs['data-border-radius'] = borderRadius;
        }

        if (figureStyles.length > 0) {
            figureAttrs.style = figureStyles.join('; ');
        }

        const content = [
            ['video', videoAttrs, ['source', sourceAttrs]]
        ];

        if (caption) {
            content.push(['figcaption', {}, caption]);
        }

        return [
            'figure',
            figureAttrs,
            ...content
        ];
    }

});
