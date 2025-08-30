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
            caption: { default: null }
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
                        caption: caption?.textContent || null
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
                        caption: null
                    };
                }
            }
        ];
    },

    renderHTML({ HTMLAttributes }) {
        const {
            src, alt, title, width, height, align, objectFit, caption
        } = HTMLAttributes;

        const imgAttrs: Record<string, string> = {
            src: src || '',
            alt: alt || ''
        };

        if (title) imgAttrs.title = title;
        if (width) imgAttrs.width = width;
        if (height) imgAttrs.height = height;
        if (objectFit && objectFit !== 'cover') imgAttrs.style = `object-fit: ${objectFit}`;

        const figureAttrs: Record<string, string> = {};
        if (align) {
            let alignStyle = `text-align: ${align};`;
            // 이미지 정렬을 위한 추가 스타일
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
