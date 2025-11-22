import { Node, mergeAttributes } from '@tiptap/core';

export const ImageGrid = Node.create({
    name: 'imageGrid',

    group: 'block',

    content: 'imageGridItem+',

    addAttributes() {
        return {
            columns: { default: 3 }
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-image-grid]'
            }
        ];
    },

    renderHTML({ HTMLAttributes }) {
        const { columns } = HTMLAttributes;
        return [
            'div',
            mergeAttributes(HTMLAttributes, {
                'data-image-grid': '',
                style: `display: grid; grid-template-columns: repeat(${columns || 3}, 1fr); gap: 0.5rem; margin: 1rem 0;`
            }),
            0
        ];
    },

    addCommands() {
        return {
            insertImageGrid: (urls: string[]) => ({ chain }) => {
                const items = urls.map(url => ({
                    type: 'imageGridItem',
                    attrs: { src: url }
                }));

                return chain()
                    .insertContent({
                        type: 'imageGrid',
                        attrs: { columns: Math.min(urls.length, 3) },
                        content: items
                    })
                    .run();
            }
        };
    }
});

export const ImageGridItem = Node.create({
    name: 'imageGridItem',

    group: 'imageGridItem',

    atom: true,

    addAttributes() {
        return {
            src: { default: null },
            alt: { default: null }
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-image-grid-item]'
            }
        ];
    },

    renderHTML({ HTMLAttributes }) {
        const { src, alt } = HTMLAttributes;
        return [
            'div',
            { 'data-image-grid-item': '', style: 'position: relative; aspect-ratio: 1 / 1; overflow: hidden; border-radius: 0.375rem;' },
            [
                'img',
                {
                    src: src || '',
                    alt: alt || '',
                    style: 'width: 100%; height: 100%; object-fit: cover; cursor: pointer;',
                    loading: 'lazy'
                }
            ]
        ];
    }
});
