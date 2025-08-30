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

                    return {
                        src: finalSrc,
                        poster: video.poster || null,
                        width: video.width || null,
                        height: video.height || null,
                        align: figure.style.textAlign || figure.getAttribute('data-align') || 'center',
                        caption: caption?.textContent || null,
                        autoplay: true,
                        muted: true,
                        loop: true,
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

                    return {
                        src: finalSrc,
                        poster: video.poster || null,
                        width: video.width || null,
                        height: video.height || null,
                        align: 'center',
                        caption: null,
                        autoplay: true,
                        muted: true,
                        loop: true,
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
            ...otherAttrs
        } = HTMLAttributes;

        const videoAttrs: Record<string, string> = {
            ...otherAttrs,
            // 항상 자동재생 속성들 추가
            autoplay: '',
            muted: '',
            loop: '',
            playsinline: ''
        };

        if (poster) videoAttrs.poster = poster;
        if (width) videoAttrs.width = width;
        if (height) videoAttrs.height = height;

        const sourceAttrs: Record<string, string> = { type: 'video/mp4' };
        if (src) sourceAttrs.src = src;

        const figureAttrs: Record<string, string> = {};
        if (align) {
            let alignStyle = `text-align: ${align};`;
            // 비디오 정렬을 위한 추가 스타일
            if (align === 'center') {
                alignStyle += ' display: flex; justify-content: center; flex-direction: column; align-items: center;';
            } else if (align === 'left') {
                alignStyle += ' display: flex; justify-content: flex-start; flex-direction: column; align-items: flex-start;';
            } else if (align === 'right') {
                alignStyle += ' display: flex; justify-content: flex-end; flex-direction: column; align-items: flex-end;';
            }
            figureAttrs.style = alignStyle;
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
    },

    addCommands() {
        return {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setVideo: (attributes: Record<string, unknown>) => ({ commands }: { commands: any }) => {
                return commands.insertContent({
                    type: this.name,
                    attrs: attributes
                });
            }
        };
    }
});
