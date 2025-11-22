import { Node } from '@tiptap/react';

export const CustomImage = Node.create({
    name: 'image',

    group: 'block',

    atom: true,

    addAttributes() {
        return {
            src: { default: null },
            alt: { default: null },
            title: { default: null },
            width: { default: null },
            height: { default: null },
            align: { default: 'center' }, // left, center, right
            objectFit: { default: 'cover' }, // cover, contain, fill, none
            caption: { default: null },
            border: { default: false }, // border 적용 여부
            shadow: { default: false }, // shadow 적용 여부
            aspectRatio: { default: null } // 16:9, 4:3, 1:1, etc
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

                    // data-src가 있으면 사용
                    if (img.dataset.src) {
                        src = img.dataset.src;
                    }

                    // preview.jpg 제거
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
                        aspectRatio: img.getAttribute('data-aspect-ratio') || null
                    };
                }
            },
            // 단독 img 태그
            {
                tag: 'img',
                getAttrs: (element) => {
                    const img = element as HTMLImageElement;
                    let src = img.src || img.getAttribute('src') || '';

                    // data-src가 있으면 사용
                    if (img.dataset.src) {
                        src = img.dataset.src;
                    }

                    // preview.jpg 제거
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
                        aspectRatio: img.getAttribute('data-aspect-ratio') || null
                    };
                }
            }
        ];
    },

    renderHTML({ HTMLAttributes }) {
        const {
            src, alt, title, width, height, align, objectFit, caption, border, shadow, aspectRatio
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
            imgAttrs['data-aspect-ratio'] = aspectRatio;
        }

        if (objectFit) {
            imgStyles.push(`object-fit: ${objectFit}`);
        }

        if (imgStyles.length > 0) {
            imgAttrs.style = imgStyles.join('; ');
        }

        const figureStyles: string[] = [];
        const figureAttrs: Record<string, string> = {};

        if (align) {
            figureStyles.push(`text-align: ${align}`);
            if (align === 'center') {
                figureStyles.push('display: flex');
                figureStyles.push('justify-content: center');
                figureStyles.push('flex-direction: column');
                figureStyles.push('align-items: center');
            } else if (align === 'left') {
                figureStyles.push('display: flex');
                figureStyles.push('justify-content: flex-start');
                figureStyles.push('flex-direction: column');
                figureStyles.push('align-items: flex-start');
            } else if (align === 'right') {
                figureStyles.push('display: flex');
                figureStyles.push('justify-content: flex-end');
                figureStyles.push('flex-direction: column');
                figureStyles.push('align-items: flex-end');
            }
        }

        if (border) {
            figureStyles.push('border: 1px solid #e5e7eb');
            figureStyles.push('overflow: hidden');
            figureAttrs['data-border'] = 'true';
        }
        if (shadow) {
            figureStyles.push('box-shadow: 8px 8px 40px 2px rgba(0, 0, 0, 0.15)');
            figureAttrs['data-shadow'] = 'true';
        }

        if (figureStyles.length > 0) {
            figureAttrs.style = figureStyles.join('; ');
        }

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
