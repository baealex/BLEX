import { Node, ReactNodeViewRenderer } from '@tiptap/react';
import { ImageNodeView } from '../components/nodeviews/ImageNodeView';
import { buildFigureAttrsForHTML } from '../utils/mediaStyles';

export const CustomImage = Node.create({
    name: 'image',

    group: 'block',

    atom: true,

    draggable: true,

    addNodeView() {
        return ReactNodeViewRenderer(ImageNodeView);
    },

    addAttributes() {
        return {
            src: { default: null },
            alt: { default: null },
            title: { default: null },
            width: { default: null },
            height: { default: null },
            align: { default: 'center' },
            objectFit: { default: 'cover' },
            caption: { default: null },
            border: { default: false },
            shadow: { default: false },
            aspectRatio: { default: null },
            borderRadius: { default: null },
            sizePreset: { default: null } // 'small', 'medium', 'large', null(=full)
        };
    },

    parseHTML() {
        return [
            // figure > img 구조
            {
                tag: 'figure',
                getAttrs: (element) => {
                    const figure = element as HTMLElement;
                    const img = figure.querySelector('img');
                    const caption = figure.querySelector('figcaption');

                    if (!img) return false;

                    let src = img.src || img.getAttribute('src') || '';

                    if (img.dataset.src) {
                        src = img.dataset.src;
                    }
                    if (src.includes('.preview.jpg')) {
                        src = src.replace('.preview.jpg', '');
                    }

                    return {
                        src,
                        alt: img.alt || null,
                        title: img.title || null,
                        width: img.width || null,
                        height: img.height || null,
                        align: figure.style.textAlign || figure.getAttribute('data-align') || 'center',
                        objectFit: img.style.objectFit || 'cover',
                        caption: caption?.textContent || null,
                        border: figure.getAttribute('data-border') === 'true',
                        shadow: figure.getAttribute('data-shadow') === 'true',
                        aspectRatio: img.getAttribute('data-aspect-ratio') || null,
                        borderRadius: figure.getAttribute('data-border-radius') || null,
                        sizePreset: figure.getAttribute('data-size') || null
                    };
                }
            },
            // 단독 img 태그
            {
                tag: 'img',
                getAttrs: (element) => {
                    const img = element as HTMLImageElement;
                    let src = img.src || img.getAttribute('src') || '';

                    if (img.dataset.src) {
                        src = img.dataset.src;
                    }
                    if (src.includes('.preview.jpg')) {
                        src = src.replace('.preview.jpg', '');
                    }

                    return {
                        src,
                        alt: img.alt || null,
                        title: img.title || null,
                        width: img.width || null,
                        height: img.height || null,
                        align: 'center',
                        objectFit: img.style.objectFit || 'cover',
                        caption: null,
                        border: false,
                        shadow: false,
                        aspectRatio: img.getAttribute('data-aspect-ratio') || null,
                        borderRadius: null,
                        sizePreset: null
                    };
                }
            }
        ];
    },

    renderHTML({ HTMLAttributes }) {
        const {
            src, alt, title, width, height, objectFit, caption, aspectRatio,
            align, border, shadow, borderRadius, sizePreset
        } = HTMLAttributes;

        const imgAttrs: Record<string, string> = {
            src: src || '',
            alt: alt || ''
        };

        if (title) imgAttrs.title = title;
        if (width) imgAttrs.width = width;
        if (height) imgAttrs.height = height;

        const imgStyles: string[] = [];
        if (aspectRatio) {
            imgStyles.push(`aspect-ratio: ${aspectRatio.replace(':', ' / ')}`);
            if (!width && !height) {
                imgStyles.push('width: 100%');
            }
            imgAttrs['data-aspect-ratio'] = aspectRatio;
        }
        if (objectFit) {
            imgStyles.push(`object-fit: ${objectFit}`);
        }
        if (imgStyles.length > 0) {
            imgAttrs.style = imgStyles.join('; ');
        }

        const { attrs: figureAttrs } = buildFigureAttrsForHTML({
            align,
            border,
            shadow,
            borderRadius,
            sizePreset
        });

        const content = [
            ['img', imgAttrs]
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
