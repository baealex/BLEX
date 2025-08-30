import { Node } from '@tiptap/react';

export const IframeNode = Node.create({
    name: 'iframe',

    group: 'block',

    atom: true,

    addAttributes() {
        return {
            src: {
                default: null,
            },
            width: {
                default: null,
            },
            height: {
                default: null,
            },
            frameborder: {
                default: '0',
            },
            allowfullscreen: {
                default: true,
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'iframe',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['iframe', HTMLAttributes];
    },

    addCommands() {
        return {
            setIframe:
                (attributes) =>
                ({ commands }) => {
                    return commands.insertContent({
                        type: this.name,
                        attrs: attributes,
                    });
                },
        };
    },
});