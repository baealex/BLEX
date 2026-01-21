import { Node, mergeAttributes } from '@tiptap/react';

export type ColumnLayout = '1:1' | '1:2' | '2:1' | '1:1:1' | '1:2:1' | '2:1:1' | '1:1:2';

export interface ColumnsAttributes {
    layout: ColumnLayout;
}

const layoutToGridTemplate: Record<ColumnLayout, string> = {
    '1:1': '1fr 1fr',
    '1:2': '1fr 2fr',
    '2:1': '2fr 1fr',
    '1:1:1': '1fr 1fr 1fr',
    '1:2:1': '1fr 2fr 1fr',
    '2:1:1': '2fr 1fr 1fr',
    '1:1:2': '1fr 1fr 2fr'
};

export const layoutToColumnCount: Record<ColumnLayout, number> = {
    '1:1': 2,
    '1:2': 2,
    '2:1': 2,
    '1:1:1': 3,
    '1:2:1': 3,
    '2:1:1': 3,
    '1:1:2': 3
};

export const ColumnNode = Node.create({
    name: 'column',

    group: 'column',

    content: 'block+',

    isolating: true,

    parseHTML() {
        return [
            { tag: 'div[data-type="column"]' }
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'div',
            mergeAttributes(HTMLAttributes, {
                'data-type': 'column',
                style: 'min-width: 0;'
            }),
            0
        ];
    }
});

export const ColumnsNode = Node.create({
    name: 'columns',

    group: 'block',

    content: 'column+',

    defining: true,

    addAttributes() {
        return {
            layout: {
                default: '1:1',
                parseHTML: (element) => element.getAttribute('data-layout') || '1:1'
            }
        };
    },

    parseHTML() {
        return [
            { tag: 'div[data-type="columns"]' }
        ];
    },

    renderHTML({ HTMLAttributes }) {
        const layout = (HTMLAttributes.layout || '1:1') as ColumnLayout;
        const gridTemplate = layoutToGridTemplate[layout] || '1fr 1fr';

        const style = [
            'display: grid',
            `grid-template-columns: ${gridTemplate}`,
            'gap: 16px',
            'margin: 16px 0'
        ].join('; ');

        return [
            'div',
            mergeAttributes({
                'data-type': 'columns',
                'data-layout': layout,
                style
            }),
            0
        ];
    },

    addCommands() {
        return {
            setColumns:
                (layout: ColumnLayout = '1:1') =>
                    ({ commands }) => {
                        const columnCount = layoutToColumnCount[layout];
                        const columns = Array.from({ length: columnCount }, () => ({
                            type: 'column',
                            content: [{ type: 'paragraph' }]
                        }));

                        return commands.insertContent({
                            type: this.name,
                            attrs: { layout },
                            content: columns
                        });
                    },

            addColumn:
                () =>
                    ({ editor, chain }) => {
                        const { selection } = editor.state;
                        const { $from } = selection;

                        // Find the columns node
                        for (let depth = $from.depth; depth >= 0; depth--) {
                            const node = $from.node(depth);
                            if (node.type.name === 'columns') {
                                const columnsPos = $from.before(depth);
                                const currentCount = node.childCount;

                                if (currentCount >= 3) return false; // Max 3 columns

                                // Insert new column at the end
                                const insertPos = columnsPos + node.nodeSize - 1;
                                const newLayout = currentCount === 1 ? '1:1' : '1:1:1';

                                return chain()
                                    .insertContentAt(insertPos, {
                                        type: 'column',
                                        content: [{ type: 'paragraph' }]
                                    })
                                    .updateAttributes('columns', { layout: newLayout })
                                    .run();
                            }
                        }
                        return false;
                    },

            removeColumn:
                () =>
                    ({ editor, chain }) => {
                        const { selection } = editor.state;
                        const { $from } = selection;

                        // Find the columns node
                        for (let depth = $from.depth; depth >= 0; depth--) {
                            const node = $from.node(depth);
                            if (node.type.name === 'columns') {
                                const columnsPos = $from.before(depth);
                                const currentCount = node.childCount;

                                if (currentCount <= 2) return false; // Min 2 columns

                                // Delete the last column
                                const lastChild = node.child(currentCount - 1);
                                const deleteFrom = columnsPos + node.nodeSize - 1 - lastChild.nodeSize;
                                const deleteTo = columnsPos + node.nodeSize - 1;
                                const newLayout = '1:1'; // Back to 2 columns

                                return chain()
                                    .deleteRange({
                                        from: deleteFrom,
                                        to: deleteTo
                                    })
                                    .updateAttributes('columns', { layout: newLayout })
                                    .run();
                            }
                        }
                        return false;
                    }
        };
    }
});

declare module '@tiptap/react' {
    interface Commands<ReturnType> {
        columns: {
            setColumns: (layout?: ColumnLayout) => ReturnType;
            addColumn: () => ReturnType;
            removeColumn: () => ReturnType;
        };
    }
}
