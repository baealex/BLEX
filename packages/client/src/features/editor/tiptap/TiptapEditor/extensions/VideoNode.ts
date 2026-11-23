import { Node, ReactNodeViewRenderer } from '@tiptap/react';
import { VideoNodeView } from '../components/nodeviews/VideoNodeView';
import { buildFigureAttrsForHTML } from '../utils/mediaStyles';
import { normalizeMediaUrlForStorage } from '../utils/mediaUrls';

export const VideoNode = Node.create({
    name: 'video',

    group: 'block',

    atom: true,

    draggable: true,

    addNodeView() {
        return ReactNodeViewRenderer(VideoNodeView);
    },

    addAttributes() {
        return {
            src: { default: null },
            poster: { default: null },
            width: { default: null },
            height: { default: null },
            align: { default: 'center' }, // left, center, right
            caption: { default: null },
            objectFit: { default: 'cover' }, // cover, contain, fill, none
            aspectRatio: { default: null }, // 16:9, 4:3, 1:1, 21:9 등
            border: { default: false },
            shadow: { default: false },
            borderRadius: { default: null }, // 0, 4, 8, 16, 9999 (px)
            sizePreset: { default: null }, // 'small', 'medium', 'large', 'full', null(=natural)
            playMode: { default: 'gif' },
            autoplay: {
                default: true,
                parseHTML: (element) => element.hasAttribute('autoplay'),
                renderHTML: (attributes) => {
                    return attributes.autoplay ? { autoplay: '' } : {};
                }
            },
            muted: {
                default: true,
                parseHTML: (element) => element.hasAttribute('muted'),
                renderHTML: (attributes) => {
                    return attributes.muted ? { muted: '' } : {};
                }
            },
            loop: {
                default: true,
                parseHTML: (element) => element.hasAttribute('loop'),
                renderHTML: (attributes) => {
                    return attributes.loop ? { loop: '' } : {};
                }
            },
            playsinline: {
                default: true,
                parseHTML: (element) => element.hasAttribute('playsinline'),
                renderHTML: (attributes) => {
                    return attributes.playsinline ? { playsinline: '' } : {};
                }
            }
        };
    },

    parseHTML() {
        return [
            {
                tag: 'figure',
                getAttrs: (element) => {
                    const figure = element as HTMLElement;
                    const video = figure.querySelector('video');
                    const caption = figure.querySelector('figcaption');

                    if (!video) return false;

                    const source = video.querySelector('source');

                    // Load stored lazy media directly when opening the editor.
                    let finalSrc =
                        video.getAttribute('src') || source?.getAttribute('src') || video.src || source?.src || null;
                    const dataSrc = source?.getAttribute('data-src') || video.getAttribute('data-src') || null;
                    if (dataSrc) {
                        finalSrc = dataSrc;
                    }

                    // Videos without controls reopen in GIF playback mode.
                    const hasControls = video.hasAttribute('controls');
                    const playMode = hasControls ? 'video' : 'gif';

                    return {
                        src: normalizeMediaUrlForStorage(finalSrc),
                        poster: normalizeMediaUrlForStorage(video.getAttribute('poster') || video.poster || null),
                        width: video.width || null,
                        height: video.height || null,
                        align: figure.style.textAlign || figure.getAttribute('data-align') || 'center',
                        caption: caption?.textContent || null,
                        objectFit: video.style.objectFit || 'cover',
                        aspectRatio: video.getAttribute('data-aspect-ratio') || null,
                        border: figure.getAttribute('data-border') === 'true',
                        shadow: figure.getAttribute('data-shadow') === 'true',
                        borderRadius: figure.getAttribute('data-border-radius') || null,
                        sizePreset: figure.getAttribute('data-size') || null,
                        playMode,
                        autoplay: !hasControls,
                        muted: !hasControls,
                        loop: !hasControls,
                        playsinline: true
                    };
                }
            },
            {
                tag: 'video',
                getAttrs: (element) => {
                    const video = element as HTMLVideoElement;
                    const source = video.querySelector('source');

                    // Load stored lazy media directly when opening the editor.
                    let finalSrc =
                        video.getAttribute('src') || source?.getAttribute('src') || video.src || source?.src || null;
                    const dataSrc = source?.getAttribute('data-src') || video.getAttribute('data-src') || null;
                    if (dataSrc) {
                        finalSrc = dataSrc;
                    }

                    // Videos without controls reopen in GIF playback mode.
                    const hasControls = video.hasAttribute('controls');
                    const playMode = hasControls ? 'video' : 'gif';

                    return {
                        src: normalizeMediaUrlForStorage(finalSrc),
                        poster: normalizeMediaUrlForStorage(video.getAttribute('poster') || video.poster || null),
                        width: video.width || null,
                        height: video.height || null,
                        align: 'center',
                        caption: null,
                        objectFit: video.style.objectFit || 'cover',
                        aspectRatio: video.getAttribute('data-aspect-ratio') || null,
                        border: false,
                        shadow: false,
                        borderRadius: null,
                        sizePreset: null,
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
            sizePreset,
            playMode
        } = HTMLAttributes;

        const videoAttrs: Record<string, string> = { playsinline: '' };

        if (playMode === 'gif') {
            videoAttrs.autoplay = '';
            videoAttrs.muted = '';
            videoAttrs.loop = '';
        } else {
            videoAttrs.controls = '';
        }

        if (poster) videoAttrs.poster = normalizeMediaUrlForStorage(poster);
        if (width && sizePreset !== 'full') videoAttrs.width = width;
        if (height) videoAttrs.height = height;

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
        if (sizePreset === 'full') {
            videoStyles.push('width: 100%');
            if (!height) {
                videoStyles.push('height: auto');
            }
        }
        if (videoStyles.length > 0) {
            videoAttrs.style = videoStyles.join('; ');
        }

        const sourceAttrs: Record<string, string> = { type: 'video/mp4' };
        if (src) sourceAttrs.src = normalizeMediaUrlForStorage(src);

        const { attrs: figureAttrs } = buildFigureAttrsForHTML({
            align,
            border,
            shadow,
            borderRadius,
            sizePreset
        });

        const content = [['video', videoAttrs, ['source', sourceAttrs]]];

        if (caption) {
            content.push(['figcaption', {}, caption]);
        }

        return ['figure', figureAttrs, ...content];
    }
});
